import { BaseAgent } from '../base'
import type { AgentMessage, MemoryEntry, MemoryType } from '@chakravyuh/core'
import { AgentError, ValidationError } from '@chakravyuh/core/errors'
import { randomUUID } from 'node:crypto'

interface MemoryQuery {
  type?: MemoryType
  agentId?: string
  query?: string
  limit?: number
  offset?: number
}

interface MemoryStats {
  totalEntries: number
  byType: Record<MemoryType, number>
  byAgent: Record<string, number>
  oldestEntry: string | null
  newestEntry: string | null
}

interface ConsolidationReport {
  sourceEntries: number
  consolidatedId: string
  type: MemoryType
  summary: string
  tags: string[]
}

export class MemoryAgent extends BaseAgent {
  private localCache = new Map<string, MemoryEntry>()
  private consolidationHistory: ConsolidationReport[] = []

  async onStart(): Promise<void> {
    this.logger.info('Memory agent ready')
    this.logger.debug('Memory tiers available', { scopes: this.config.memoryScope })
  }

  async onMessage(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const data = message.payload.data as Record<string, unknown> | undefined
    const context = message.payload.context ?? {}

    const normalized = task.toLowerCase()

    if (/\b(store|save|remember|add|create)\b/.test(normalized)) {
      return this.handleStore(message)
    }

    if (/\b(search|find|query|retrieve|lookup|recall|get)\b/.test(normalized)) {
      return this.handleSearch(message)
    }

    if (/\b(delete|remove|forget|erase|clear)\b/.test(normalized)) {
      return this.handleDelete(message)
    }

    if (/\b(list|all|enumerate|show)\b/.test(normalized)) {
      return this.handleList(message)
    }

    if (/\b(consolidate|merge|compress|summarize)\b/.test(normalized)) {
      return this.handleConsolidate(message)
    }

    if (/\b(stats|statistics|count|status|health)\b/.test(normalized)) {
      return this.handleStats(message)
    }

    if (/\b(update|edit|modify|change)\b/.test(normalized)) {
      return this.handleUpdate(message)
    }

    if (data && ('content' in data || 'type' in data)) {
      return this.handleStore(message)
    }

    return this.handleSearch(message)
  }

  async onError(error: Error, message: AgentMessage): Promise<void> {
    this.logger.error('Memory error', { error: error.message, taskId: message.id })
  }

  private async handleStore(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const data = message.payload.data as Record<string, unknown> | undefined
    const context = message.payload.context ?? {}

    const memoryType = this.extractMemoryType(task) ?? (data?.type as MemoryType) ?? 'working'
    const content = data?.content as string ?? task.replace(/\b(store|save|remember|add|create)\b/i, '').trim()
    const agentId = (data?.agentId as string) ?? message.from
    const tags = this.extractTags(task)

    if (!content || content.length === 0) {
      return this.reply(message, { data: { error: 'No content provided to store' } })
    }

    if (!this.config.memoryScope.includes(memoryType)) {
      return this.reply(message, {
        data: { error: `Memory type "${memoryType}" not in agent scope (${this.config.memoryScope.join(', ')})` },
      })
    }

    const entry: Omit<MemoryEntry, 'id' | 'createdAt'> = {
      type: memoryType,
      agentId,
      content,
      metadata: {
        ...(data?.metadata as Record<string, unknown> ?? {}),
        tags,
        source: message.from,
        traceId: message.metadata.traceId,
        correlationId: message.metadata.correlationId,
      },
    }

    try {
      const stored = await this.memory.store(entry)

      this.localCache.set(stored.id, stored)

      this.logger.debug('Memory stored', {
        id: stored.id,
        type: memoryType,
        agentId,
        contentLength: content.length,
      })

      this.broadcast('memory.stored', {
        id: stored.id,
        type: memoryType,
        agentId,
        tags,
      })

      return this.reply(message, {
        data: {
          id: stored.id,
          type: stored.type,
          agentId: stored.agentId,
          createdAt: stored.createdAt,
          expiresAt: stored.expiresAt,
          contentLength: content.length,
        },
      })
    } catch (error) {
      throw new AgentError(`Failed to store memory: ${(error as Error).message}`, { memoryType, agentId })
    }
  }

  private async handleSearch(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const data = message.payload.data as Record<string, unknown> | undefined
    const query = (data?.query as string) ?? task
    const limit = (data?.limit as number) ?? this.extractNumber(task) ?? 10
    const memoryType = this.extractMemoryType(task)
    const agentId = data?.agentId as string | undefined

    this.logger.info('Searching memory', { query: query.slice(0, 80), type: memoryType, limit })

    try {
      const results = await this.memory.search(memoryType ?? 'semantic', query, limit)

      let filtered = results
      if (agentId) {
        filtered = filtered.filter(e => e.agentId === agentId)
      }

      for (const entry of filtered) {
        this.localCache.set(entry.id, entry)
      }

      return this.reply(message, {
        data: {
          query,
          count: filtered.length,
          results: filtered.map(e => ({
            id: e.id,
            type: e.type,
            agentId: e.agentId,
            content: e.content.slice(0, 500),
            metadata: e.metadata,
            createdAt: e.createdAt,
            expiresAt: e.expiresAt,
          })),
        },
      })
    } catch (error) {
      throw new AgentError(`Memory search failed: ${(error as Error).message}`, { query })
    }
  }

  private async handleDelete(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const data = message.payload.data as Record<string, unknown> | undefined
    const id = data?.id as string ?? this.extractId(task)

    if (!id) {
      const type = this.extractMemoryType(task)
      if (type) {
        const entries = await this.memory.search(type, '', 100)
        let deleted = 0
        for (const entry of entries) {
          await this.memory.forget(entry.id)
          this.localCache.delete(entry.id)
          deleted++
        }
        return this.reply(message, { data: { deleted, type, message: `Deleted ${deleted} ${type} memories` } })
      }
      return this.reply(message, { data: { error: 'No memory ID or type provided for deletion' } })
    }

    try {
      const existed = this.localCache.has(id) || (await this.memory.recall(id)) !== null
      const result = await this.memory.forget(id)
      this.localCache.delete(id)

      if (result) {
        this.broadcast('memory.deleted', { id })
        return this.reply(message, { data: { id, deleted: true } })
      }
      return this.reply(message, { data: { id, deleted: false, error: 'Memory not found' } })
    } catch (error) {
      throw new AgentError(`Failed to delete memory: ${(error as Error).message}`, { id })
    }
  }

  private async handleList(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const type = this.extractMemoryType(task)
    const limit = this.extractNumber(task) ?? 50

    try {
      const results = await this.memory.search(type ?? 'working', '', limit)

      const grouped = this.groupByType(results)

      return this.reply(message, {
        data: {
          total: results.length,
          byType: grouped,
          entries: results.slice(0, limit).map(e => ({
            id: e.id,
            type: e.type,
            agentId: e.agentId,
            contentPreview: e.content.slice(0, 100),
            createdAt: e.createdAt,
          })),
        },
      })
    } catch (error) {
      throw new AgentError(`Failed to list memories: ${(error as Error).message}`)
    }
  }

  private async handleConsolidate(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const type = this.extractMemoryType(task) ?? 'episodic'

    this.logger.info('Consolidating memories', { type })

    try {
      const entries = await this.memory.search(type, '', 100)
      if (entries.length === 0) {
        return this.reply(message, { data: { error: `No ${type} memories to consolidate` } })
      }

      const combinedContent = entries.map(e => `[${e.agentId}] ${e.content}`).join('\n')

      const completion = await this.provider.complete({
        model: this.config.model,
        messages: [
          {
            role: 'system',
            content: 'Consolidate the following memory entries into a concise summary. Extract key facts, patterns, and important details. Return the summary only.',
          },
          { role: 'user', content: combinedContent },
        ],
        maxTokens: 1024,
      })

      const consolidated: MemoryEntry = await this.memory.store({
        type: 'semantic',
        agentId: this.id,
        content: completion.content,
        metadata: {
          consolidated: true,
          sourceType: type,
          sourceCount: entries.length,
          consolidatedAt: new Date().toISOString(),
          tags: ['consolidated', type],
        },
      })

      const report: ConsolidationReport = {
        sourceEntries: entries.length,
        consolidatedId: consolidated.id,
        type,
        summary: completion.content.slice(0, 200),
        tags: ['consolidated', type],
      }

      this.consolidationHistory.push(report)
      this.localCache.set(consolidated.id, consolidated)

      return this.reply(message, { data: report })
    } catch (error) {
      throw new AgentError(`Consolidation failed: ${(error as Error).message}`, { type })
    }
  }

  private async handleStats(message: AgentMessage): Promise<AgentMessage> {
    const allEntries = [...this.localCache.values()]

    const byType = {} as Record<MemoryType, number>
    const byAgent = {} as Record<string, number>

    for (const entry of allEntries) {
      byType[entry.type] = (byType[entry.type] ?? 0) + 1
      byAgent[entry.agentId] = (byAgent[entry.agentId] ?? 0) + 1
    }

    const timestamps = allEntries.map(e => e.createdAt).sort()
    const stats: MemoryStats = {
      totalEntries: allEntries.length,
      byType,
      byAgent,
      oldestEntry: timestamps[0] ?? null,
      newestEntry: timestamps[timestamps.length - 1] ?? null,
    }

    return this.reply(message, { data: stats })
  }

  private async handleUpdate(message: AgentMessage): Promise<AgentMessage> {
    const data = message.payload.data as Record<string, unknown> | undefined
    const id = data?.id as string ?? this.extractId(message.payload.task ?? '')

    if (!id) {
      return this.reply(message, { data: { error: 'No memory ID provided for update' } })
    }

    const existing = this.localCache.get(id) ?? await this.memory.recall(id)
    if (!existing) {
      return this.reply(message, { data: { error: `Memory ${id} not found` } })
    }

    const newContent = data?.content as string ?? message.payload.task?.replace(/\b(update|edit|modify|change)\b/i, '').trim()
    if (!newContent) {
      return this.reply(message, { data: { error: 'No new content provided for update' } })
    }

    await this.memory.forget(id)
    const updated = await this.memory.store({
      type: existing.type,
      agentId: existing.agentId,
      content: newContent,
      metadata: { ...existing.metadata, updatedAt: new Date().toISOString(), previousId: id },
    })

    this.localCache.delete(id)
    this.localCache.set(updated.id, updated)

    return this.reply(message, {
      data: {
        id: updated.id,
        previousId: id,
        type: updated.type,
        contentLength: newContent.length,
      },
    })
  }

  private extractMemoryType(task: string): MemoryType | null {
    const lower = task.toLowerCase()
    if (/\bworking\b/.test(lower)) return 'working'
    if (/\b(episodic|conversation|session)\b/.test(lower)) return 'episodic'
    if (/\b(semantic|knowledge|fact)\b/.test(lower)) return 'semantic'
    if (/\b(procedural|workflow|template|prompt)\b/.test(lower)) return 'procedural'
    return null
  }

  private extractNumber(task: string): number | null {
    const match = task.match(/(\d+)/)
    return match ? parseInt(match[1]!, 10) : null
  }

  private extractId(task: string): string | null {
    const patterns = [
      /(?:id|memory)\s*[=:]\s*([a-f0-9-]{36}|[a-f0-9]{8,})/i,
      /\b([a-f0-9-]{36})\b/,
    ]
    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match?.[1]) return match[1]
    }
    return null
  }

  private extractTags(task: string): string[] {
    const tags: string[] = []
    const tagMatch = task.match(/(?:tag|label)s?\s*[=:]\s*\[([^\]]+)\]/i)
    if (tagMatch) {
      tags.push(...tagMatch[1]!.split(',').map(t => t.trim().replace(/['"]/g, '')).filter(Boolean))
    }
    const hashtags = task.match(/#(\w+)/g)
    if (hashtags) {
      tags.push(...hashtags.map(h => h.slice(1)))
    }
    return [...new Set(tags)]
  }

  private groupByType(entries: MemoryEntry[]): Record<string, number> {
    const grouped: Record<string, number> = {}
    for (const entry of entries) {
      grouped[entry.type] = (grouped[entry.type] ?? 0) + 1
    }
    return grouped
  }
}
