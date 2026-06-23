import { BaseAgent } from '../base'
import type { AgentMessage } from '@chakravyuh/core'
import { AgentError } from '@chakravyuh/core/errors'

interface SearchResult {
  url: string
  title: string
  snippet: string
  relevanceScore: number
}

interface ResearchFinding {
  topic: string
  sources: SearchResult[]
  summary: string
  keyPoints: string[]
  confidence: 'high' | 'medium' | 'low'
  followUpQuestions?: string[]
}

interface FactCheckResult {
  claim: string
  verdict: 'supported' | 'contradicted' | 'unverifiable'
  evidence: SearchResult[]
  confidence: number
}

export class ResearcherAgent extends BaseAgent {
  private researchCache = new Map<string, ResearchFinding>()
  private recentSearches: string[] = []

  async onStart(): Promise<void> {
    this.logger.info('Researcher agent ready')
  }

  async onMessage(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const context = message.payload.context ?? {}

    const normalized = task.toLowerCase()

    if (/\b(fact.?check|verify|is\s+it\s+true|validate\s+claim)\b/.test(normalized)) {
      return this.handleFactCheck(message)
    }

    if (/\b(compare|contrast|vs\.?|versus|differences)\b/.test(normalized)) {
      return this.handleComparison(message)
    }

    if (/\b(summarize|summary|tl;dr|digest|brief)\b/.test(normalized)) {
      return this.handleSummarize(message)
    }

    if (/\b(deep.?dive|comprehensive|detailed\s+research|thorough)\b/.test(normalized)) {
      return this.handleDeepResearch(message)
    }

    return this.handleGeneralSearch(message)
  }

  async onError(error: Error, message: AgentMessage): Promise<void> {
    this.logger.error('Researcher error', { error: error.message, taskId: message.id })

    if (this.recentSearches.length > 0) {
      this.researchCache.clear()
    }
  }

  private async handleGeneralSearch(message: AgentMessage): Promise<AgentMessage> {
    const query = message.payload.task ?? ''

    this.logger.info('Performing search', { query: query.slice(0, 100) })

    const cached = this.checkCache(query)
    if (cached) {
      this.logger.debug('Returning cached result', { query: query.slice(0, 50) })
      return this.reply(message, { data: cached })
    }

    try {
      const searchResults = await this.performSearch(query, 8)

      let contentResults: Array<{ url: string; content: string }> = []
      try {
        const topUrls = searchResults.slice(0, 3).filter(r => r.relevanceScore > 0.3)
        contentResults = await this.fetchContent(topUrls)
      } catch {
        this.logger.warn('Content fetching failed for some sources, using snippets only')
      }

      const finding = this.synthesizeFindings(query, searchResults, contentResults)

      this.researchCache.set(this.cacheKey(query), finding)
      this.recentSearches.push(query)
      if (this.recentSearches.length > 20) this.recentSearches.shift()

      await this.storeProcedural(JSON.stringify(finding, null, 2), { type: 'research', query })

      return this.reply(message, { data: finding })
    } catch (error) {
      if (error instanceof AgentError) throw error
      throw new AgentError(`Research failed: ${(error as Error).message}`, { query })
    }
  }

  private async handleFactCheck(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const claimMatch = task.match(/(?:claim|statement|assertion|quote)?:?\s*[`'"]?(.+?)[`'"]?\s*$/i)
    const claim = claimMatch?.[1] ?? task

    this.logger.info('Fact-checking claim', { claim: claim.slice(0, 100) })

    const results = await this.performSearch(claim, 5)
    const verdict = this.determineVerdict(claim, results)

    return this.reply(message, { data: verdict })
  }

  private async handleComparison(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const items = this.extractComparisonItems(task)

    if (items.length < 2) {
      return this.reply(message, { data: { error: 'Need at least 2 items to compare' } })
    }

    this.logger.info('Comparing items', { items })

    const searchResults = await Promise.all(
      items.map(item => this.performSearch(`${item} ${items.filter(i => i !== item).join(' ')}`, 5))
    )

    const comparison = items.map((item, i) => ({
      item,
      sources: searchResults[i] ?? [],
    }))

    return this.reply(message, { data: { comparison, summary: `Compared ${items.join(' vs ')}` } })
  }

  private async handleSummarize(message: AgentMessage): Promise<AgentMessage> {
    const query = message.payload.task ?? ''
    const urlMatch = query.match(/https?:\/\/[^\s]+/)

    if (urlMatch) {
      const url = urlMatch[0]
      try {
        const content = await this.callTool('web-fetch', { url, format: 'markdown' })
        const summary = this.generateSummary(content as string, 500)
        return this.reply(message, { data: { url, summary, originalLength: (content as string).length } })
      } catch (error) {
        return this.reply(message, { data: { error: `Failed to fetch URL: ${(error as Error).message}` } })
      }
    }

    const searchResults = await this.performSearch(query, 5)
    const combinedContent = searchResults.map(r => r.snippet).join('\n')
    const summary = this.generateSummary(combinedContent, 300)

    return this.reply(message, { data: { query, summary, sources: searchResults } })
  }

  private async handleDeepResearch(message: AgentMessage): Promise<AgentMessage> {
    const topic = message.payload.task ?? ''
    this.logger.info('Deep research on topic', { topic: topic.slice(0, 100) })

    const subQueries = this.generateSubQueries(topic)
    const allResults: ResearchFinding[] = []

    for (const subQuery of subQueries) {
      try {
        const finding = await this.performSearch(subQuery, 5)
        const synthesized = this.synthesizeFindings(subQuery, finding, [])
        allResults.push(synthesized)
      } catch {
        this.logger.warn('Sub-query failed, continuing', { subQuery })
      }
    }

    const consolidated = this.consolidateFindings(topic, allResults)

    await this.storeProcedural(JSON.stringify(consolidated, null, 2), { type: 'deep_research', topic })

    return this.reply(message, { data: consolidated })
  }

  private async performSearch(query: string, limit: number): Promise<SearchResult[]> {
    const webResults = await this.callTool('web-search', {
      query,
      numResults: limit,
      type: 'auto',
    })

    const rawResults = webResults as Array<{ url?: string; title?: string; snippet?: string }>

    return rawResults.map((r, i) => ({
      url: r.url ?? '',
      title: r.title ?? `Result ${i + 1}`,
      snippet: r.snippet ?? '',
      relevanceScore: this.calculateRelevance(query, r.title ?? '', r.snippet ?? ''),
    })).filter(r => r.relevanceScore > 0.1)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit)
  }

  private async fetchContent(sources: SearchResult[]): Promise<Array<{ url: string; content: string }>> {
    const results: Array<{ url: string; content: string }> = []

    for (const source of sources) {
      try {
        const content = await this.callTool('web-fetch', { url: source.url, format: 'markdown' })
        results.push({ url: source.url, content: (content as string).slice(0, 5000) })
      } catch {
        this.logger.debug('Failed to fetch content', { url: source.url })
      }
    }

    return results
  }

  private synthesizeFindings(
    query: string,
    searchResults: SearchResult[],
    contentResults: Array<{ url: string; content: string }>,
  ): ResearchFinding {
    const contentMap = new Map(contentResults.map(r => [r.url, r.content]))
    const keyPoints = this.extractKeyPoints(searchResults, contentMap)

    return {
      topic: query,
      sources: searchResults,
      summary: keyPoints.slice(0, 3).join(' ') || 'No summary could be generated',
      keyPoints,
      confidence: searchResults.length >= 3 ? 'high' : searchResults.length > 0 ? 'medium' : 'low',
      followUpQuestions: this.generateFollowUps(query, keyPoints),
    }
  }

  private determineVerdict(claim: string, results: SearchResult[]): FactCheckResult {
    const supporting = results.filter(r =>
      r.snippet.toLowerCase().includes(claim.toLowerCase().slice(0, 20))
    )
    const contradicting = results.filter(r =>
      /(false|incorrect|misleading|debunked|myth)/i.test(r.snippet)
    )

    let verdict: FactCheckResult['verdict']
    let confidence: number

    if (supporting.length > contradicting.length) {
      verdict = 'supported'
      confidence = supporting.length / results.length
    } else if (contradicting.length > 0) {
      verdict = 'contradicted'
      confidence = contradicting.length / results.length
    } else {
      verdict = 'unverifiable'
      confidence = 0
    }

    return { claim, verdict, evidence: results, confidence }
  }

  private extractComparisonItems(task: string): string[] {
    const separators = /\b(vs\.?|versus|and|or|,)\b/i
    const items = task.split(separators)
      .map(i => i.trim())
      .filter(i => i.length > 1 && !separators.test(i))

    const comparisonMatch = task.match(/compare\s+(.+?)\s+(?:with|to|and|vs)\s+(.+)/i)
    if (comparisonMatch) {
      return [comparisonMatch[1]!, comparisonMatch[2]!].map(s => s.trim())
    }

    return items.slice(0, 4)
  }

  private generateSubQueries(topic: string): string[] {
    const prefixes = [
      `What is ${topic}`,
      `${topic} latest developments 2026`,
      `${topic} best practices`,
      `${topic} tools and frameworks`,
      `${topic} challenges and limitations`,
    ]
    return prefixes
  }

  private consolidateFindings(topic: string, findings: ResearchFinding[]): ResearchFinding {
    const allSources = findings.flatMap(f => f.sources)
    const uniqueUrls = new Set<string>()
    const uniqueSources = allSources.filter(s => {
      if (uniqueUrls.has(s.url)) return false
      uniqueUrls.add(s.url)
      return true
    })

    const allKeyPoints = findings.flatMap(f => f.keyPoints)
    const uniquePoints = [...new Set(allKeyPoints)]

    return {
      topic,
      sources: uniqueSources,
      summary: uniquePoints.slice(0, 5).join(' '),
      keyPoints: uniquePoints,
      confidence: findings.some(f => f.confidence === 'high') ? 'high' : 'medium',
      followUpQuestions: findings.flatMap(f => f.followUpQuestions ?? []).slice(0, 5),
    }
  }

  private calculateRelevance(query: string, title: string, snippet: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2)
    const combined = `${title} ${snippet}`.toLowerCase()

    const matches = queryTerms.filter(t => combined.includes(t))
    return matches.length / Math.max(queryTerms.length, 1)
  }

  private extractKeyPoints(
    searchResults: SearchResult[],
    contentMap: Map<string, string>,
  ): string[] {
    const points: string[] = []

    for (const result of searchResults) {
      const content = contentMap.get(result.url)
      if (content) {
        const sentences = content.match(/[^.!?]+[.!?]+/g) ?? []
        const meaningful = sentences
          .filter(s => s.length > 20 && s.length < 300)
          .slice(0, 3)
        points.push(...meaningful)
      }
      if (result.snippet) {
        points.push(result.snippet)
      }
    }

    return [...new Set(points)].slice(0, 10)
  }

  private generateSummary(content: string, maxLength: number): string {
    const sentences = content.match(/[^.!?]+[.!?]+/g) ?? []
    let summary = ''

    for (const sentence of sentences) {
      if ((summary + sentence).length > maxLength) break
      summary += sentence + ' '
    }

    return summary.trim() || content.slice(0, maxLength)
  }

  private generateFollowUps(query: string, keyPoints: string[]): string[] {
    const followUps: string[] = []

    if (keyPoints.length > 0) {
      followUps.push(`What are the counterarguments to: ${keyPoints[0]?.slice(0, 80)}?`)
    }

    const whoMatch = query.match(/what\s+is\s+(.+)/i)
    if (whoMatch) {
      followUps.push(`How does ${whoMatch[1]} compare to alternatives?`)
    }

    followUps.push(`What are the latest updates on ${query}?`)
    followUps.push(`What are practical examples of ${query}?`)

    return followUps.slice(0, 3)
  }

  private checkCache(query: string): ResearchFinding | null {
    const key = this.cacheKey(query)
    return this.researchCache.get(key) ?? null
  }

  private cacheKey(query: string): string {
    return query.toLowerCase().replace(/\s+/g, ' ').trim()
  }
}
