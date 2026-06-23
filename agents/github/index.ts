import { BaseAgent } from '../base'
import type { AgentMessage } from '@chakravyuh/core'
import { AgentError } from '@chakravyuh/core/errors'

interface PRInfo {
  number: number
  title: string
  description: string
  state: 'open' | 'closed' | 'merged'
  base: string
  head: string
  author: string
  createdAt: string
  labels: string[]
  reviewStatus: 'approved' | 'changes_requested' | 'pending' | 'draft'
}

interface IssueInfo {
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  labels: string[]
  assignees: string[]
  createdAt: string
  comments: number
}

interface RepoInfo {
  owner: string
  name: string
  description: string
  defaultBranch: string
  visibility: 'public' | 'private'
  language: string
  topics: string[]
  openIssues: number
  openPRs: number
  stars: number
  forks: number
}

export class GitHubAgent extends BaseAgent {
  private repoCache = new Map<string, RepoInfo>()
  private prCache = new Map<number, PRInfo>()

  async onStart(): Promise<void> {
    this.logger.info('GitHub agent ready')
  }

  async onMessage(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const context = message.payload.context ?? {}

    const normalized = task.toLowerCase()

    if (/\b(pull.?request|pr)\b/.test(normalized)) {
      if (/\b(create|open|new|make)\b/.test(normalized)) return this.handleCreatePR(message)
      if (/\b(merge|approve|land)\b/.test(normalized)) return this.handleMergePR(message)
      if (/\b(review|check|list|get)\b/.test(normalized)) return this.handleGetPR(message)
      if (/\b(close|abandon|reject)\b/.test(normalized)) return this.handleClosePR(message)
      if (/\b(comment|note|feedback)\b/.test(normalized)) return this.handlePRComment(message)
      return this.handleGetPR(message)
    }

    if (/\b(issue|bug|ticket)\b/.test(normalized)) {
      if (/\b(create|open|new|file)\b/.test(normalized)) return this.handleCreateIssue(message)
      if (/\b(close|resolve|fix)\b/.test(normalized)) return this.handleCloseIssue(message)
      if (/\b(list|find|search|get)\b/.test(normalized)) return this.handleListIssues(message)
      return this.handleListIssues(message)
    }

    if (/\b(repo|repository)\b/.test(normalized)) {
      if (/\b(create|init|new)\b/.test(normalized)) return this.handleCreateRepo(message)
      if (/\b(info|details|get|show)\b/.test(normalized)) return this.handleRepoInfo(message)
      if (/\b(list|my|all)\b/.test(normalized)) return this.handleListRepos(message)
      return this.handleRepoInfo(message)
    }

    if (/\b(branch|clone|push|commit|status)\b/.test(normalized)) {
      return this.handleGitOperation(message)
    }

    if (/\b(action|workflow|ci|cd)\b/.test(normalized)) {
      return this.handleActions(message)
    }

    return this.handleGeneralGitHub(message)
  }

  async onError(error: Error, message: AgentMessage): Promise<void> {
    this.logger.error('GitHub error', { error: error.message, taskId: message.id })
  }

  private async handleCreatePR(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task)
    const title = this.extractTitle(task) ?? 'Untitled PR'
    const description = this.extractDescription(task) ?? ''
    const head = this.extractHeadBranch(task) ?? 'feature'
    const base = this.extractBaseBranch(task) ?? 'main'

    this.logger.info('Creating PR', { repo, title: title.slice(0, 50) })

    try {
      const result = await this.callTool('github', {
        action: 'create_pull_request',
        repo,
        title,
        description,
        head,
        base,
      })

      const pr = result as PRInfo
      this.prCache.set(pr.number, pr)

      this.broadcast('github.pr.created', { repo, prNumber: pr.number, title })

      return this.reply(message, {
        data: {
          number: pr.number,
          url: `https://github.com/${repo}/pull/${pr.number}`,
          title: pr.title,
          state: pr.state,
          base: pr.base,
          head: pr.head,
        },
      })
    } catch (error) {
      throw new AgentError(`Failed to create PR: ${(error as Error).message}`, { repo, title })
    }
  }

  private async handleMergePR(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task)
    const prNumber = this.extractPRNumber(task)

    if (!prNumber) {
      return this.reply(message, { data: { error: 'No PR number specified' } })
    }

    this.logger.info('Merging PR', { repo, prNumber })

    try {
      const result = await this.callTool('github', {
        action: 'merge_pull_request',
        repo,
        prNumber,
        mergeMethod: this.extractMergeMethod(task),
      })

      return this.reply(message, { data: { prNumber, merged: true, result } })
    } catch (error) {
      throw new AgentError(`Failed to merge PR: ${(error as Error).message}`, { repo, prNumber })
    }
  }

  private async handleGetPR(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task)
    const prNumber = this.extractPRNumber(task)

    if (!prNumber) {
      return this.handleListPRs(message)
    }

    this.logger.info('Getting PR details', { repo, prNumber })

    try {
      const result = await this.callTool('github', {
        action: 'get_pull_request',
        repo,
        prNumber,
      })

      const pr = result as PRInfo
      this.prCache.set(pr.number, pr)

      return this.reply(message, { data: pr })
    } catch (error) {
      throw new AgentError(`Failed to get PR: ${(error as Error).message}`, { repo, prNumber })
    }
  }

  private async handleListPRs(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task) ?? this.extractDefaultRepo()
    const state = /closed/i.test(task) ? 'closed' : 'open'

    this.logger.info('Listing PRs', { repo, state })

    try {
      const result = await this.callTool('github', {
        action: 'list_pull_requests',
        repo,
        state,
      })

      const prs = result as PRInfo[]
      for (const pr of prs) {
        this.prCache.set(pr.number, pr)
      }

      return this.reply(message, {
        data: {
          repo,
          state,
          count: prs.length,
          pullRequests: prs.map(pr => ({
            number: pr.number,
            title: pr.title,
            state: pr.state,
            author: pr.author,
            createdAt: pr.createdAt,
            reviewStatus: pr.reviewStatus,
          })),
        },
      })
    } catch (error) {
      throw new AgentError(`Failed to list PRs: ${(error as Error).message}`, { repo })
    }
  }

  private async handleClosePR(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task)
    const prNumber = this.extractPRNumber(task)

    if (!prNumber) {
      return this.reply(message, { data: { error: 'No PR number specified' } })
    }

    try {
      await this.callTool('github', { action: 'close_pull_request', repo, prNumber })
      return this.reply(message, { data: { prNumber, closed: true } })
    } catch (error) {
      throw new AgentError(`Failed to close PR: ${(error as Error).message}`, { repo, prNumber })
    }
  }

  private async handlePRComment(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task)
    const prNumber = this.extractPRNumber(task)
    const comment = task.replace(/comment|note|feedback|on\s+PR/i, '').trim()

    if (!prNumber) {
      return this.reply(message, { data: { error: 'No PR number specified' } })
    }

    try {
      await this.callTool('github', { action: 'create_pr_comment', repo, prNumber, comment })
      return this.reply(message, { data: { prNumber, commented: true } })
    } catch (error) {
      throw new AgentError(`Failed to comment on PR: ${(error as Error).message}`, { repo, prNumber })
    }
  }

  private async handleCreateIssue(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task)
    const title = this.extractTitle(task) ?? 'Untitled Issue'
    const body = this.extractDescription(task) ?? ''
    const labels = this.extractLabels(task)

    this.logger.info('Creating issue', { repo, title: title.slice(0, 50) })

    try {
      const result = await this.callTool('github', {
        action: 'create_issue',
        repo,
        title,
        body,
        labels,
      })

      const issue = result as IssueInfo

      this.broadcast('github.issue.created', { repo, issueNumber: issue.number, title })

      return this.reply(message, {
        data: {
          number: issue.number,
          url: `https://github.com/${repo}/issues/${issue.number}`,
          title: issue.title,
          state: issue.state,
          labels: issue.labels,
        },
      })
    } catch (error) {
      throw new AgentError(`Failed to create issue: ${(error as Error).message}`, { repo, title })
    }
  }

  private async handleCloseIssue(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task)
    const issueNumber = this.extractIssueNumber(task)

    if (!issueNumber) {
      return this.reply(message, { data: { error: 'No issue number specified' } })
    }

    try {
      await this.callTool('github', { action: 'close_issue', repo, issueNumber })
      return this.reply(message, { data: { issueNumber, closed: true } })
    } catch (error) {
      throw new AgentError(`Failed to close issue: ${(error as Error).message}`, { repo, issueNumber })
    }
  }

  private async handleListIssues(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task) ?? this.extractDefaultRepo()
    const state = /closed/i.test(task) ? 'closed' : 'open'

    this.logger.info('Listing issues', { repo, state })

    try {
      const result = await this.callTool('github', {
        action: 'list_issues',
        repo,
        state,
      })

      const issues = result as IssueInfo[]

      return this.reply(message, {
        data: {
          repo,
          state,
          count: issues.length,
          issues: issues.map(issue => ({
            number: issue.number,
            title: issue.title,
            state: issue.state,
            labels: issue.labels,
            assignees: issue.assignees,
            createdAt: issue.createdAt,
            comments: issue.comments,
          })),
        },
      })
    } catch (error) {
      throw new AgentError(`Failed to list issues: ${(error as Error).message}`, { repo })
    }
  }

  private async handleCreateRepo(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repoName = this.extractRepoName(task) ?? this.extractRepo(task)?.split('/')[1]

    if (!repoName) {
      return this.reply(message, { data: { error: 'No repository name specified' } })
    }

    const visibility = /private/i.test(task) ? 'private' : 'public'
    const description = this.extractDescription(task) ?? ''

    this.logger.info('Creating repository', { repoName, visibility })

    try {
      const result = await this.callTool('github', {
        action: 'create_repository',
        name: repoName,
        visibility,
        description,
        autoInit: true,
      })

      const repo = result as RepoInfo

      return this.reply(message, {
        data: {
          name: `${repo.owner}/${repo.name}`,
          visibility: repo.visibility,
          description: repo.description,
          defaultBranch: repo.defaultBranch,
        },
      })
    } catch (error) {
      throw new AgentError(`Failed to create repo: ${(error as Error).message}`, { repoName })
    }
  }

  private async handleRepoInfo(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task)

    if (!repo) {
      return this.reply(message, { data: { error: 'No repository specified' } })
    }

    this.logger.info('Getting repo info', { repo })

    try {
      const result = await this.callTool('github', { action: 'get_repository', repo })
      const info = result as RepoInfo
      this.repoCache.set(repo, info)

      return this.reply(message, { data: info })
    } catch (error) {
      throw new AgentError(`Failed to get repo info: ${(error as Error).message}`, { repo })
    }
  }

  private async handleListRepos(message: AgentMessage): Promise<AgentMessage> {
    try {
      const result = await this.callTool('github', { action: 'list_repositories' })
      const repos = result as RepoInfo[]

      for (const repo of repos) {
        this.repoCache.set(`${repo.owner}/${repo.name}`, repo)
      }

      return this.reply(message, {
        data: {
          total: repos.length,
          repos: repos.map(r => ({
            name: `${r.owner}/${r.name}`,
            description: r.description,
            visibility: r.visibility,
            language: r.language,
            stars: r.stars,
          })),
        },
      })
    } catch (error) {
      throw new AgentError(`Failed to list repos: ${(error as Error).message}`)
    }
  }

  private async handleGitOperation(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task)

    try {
      const result = await this.callTool('github', {
        action: 'git_operation',
        repo,
        command: task,
      })

      return this.reply(message, { data: { result } })
    } catch (error) {
      throw new AgentError(`Git operation failed: ${(error as Error).message}`)
    }
  }

  private async handleActions(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const repo = this.extractRepo(task)

    try {
      const result = await this.callTool('github', {
        action: 'list_workflows',
        repo,
      })

      return this.reply(message, { data: result })
    } catch (error) {
      throw new AgentError(`Actions failed: ${(error as Error).message}`, { repo })
    }
  }

  private async handleGeneralGitHub(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''

    const repo = this.extractRepo(task)
    if (!repo) {
      return this.reply(message, { data: { error: 'Could not determine GitHub repo or operation from task' } })
    }

    try {
      const result = await this.callTool('github', {
        action: 'execute',
        repo,
        query: task,
      })
      return this.reply(message, { data: result })
    } catch (error) {
      throw new AgentError(`GitHub operation failed: ${(error as Error).message}`)
    }
  }

  private extractRepo(task: string): string | null {
    const patterns = [
      /(?:repo|repository)\s*[`'"]?([\w-]+\/[\w.-]+)[`'"]?/i,
      /(?:in|from|of)\s+[`'"]?([\w-]+\/[\w.-]+)[`'"]?/i,
      /github\.com\/([\w-]+\/[\w.-]+)/i,
    ]

    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match?.[1]) return match[1].replace(/\/$/, '')
    }
    return null
  }

  private extractPRNumber(task: string): number | null {
    const patterns = [
      /(?:PR|#|pull.?request)\s*#?(\d+)/i,
      /#(\d+)/,
    ]
    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match?.[1]) return parseInt(match[1], 10)
    }
    return null
  }

  private extractIssueNumber(task: string): number | null {
    return this.extractPRNumber(task)
  }

  private extractTitle(task: string): string | null {
    const patterns = [
      /(?:title|name)\s*[:=]\s*[`'"]?(.+?)[`'"]?(?:\s+(?:description|body|with|and|,|$))/i,
      /(?:called|titled|named)\s[`'"]?(.+?)[`'"]?(?:\s|$)/i,
    ]

    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match?.[1]) return match[1].trim()
    }

    const sentences = task.split(/[.;]\s+/)
    return sentences[0]?.trim() ?? null
  }

  private extractDescription(task: string): string | null {
    const patterns = [
      /(?:description|body|details)\s*[:=]\s*[`'"]?(.+?)[`'"]?(?:\s+(?:labels?|assignee|with|and|,|$))/i,
      /(?:description|body):\s*```(?:markdown)?\n([\s\S]*?)```/i,
    ]

    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match?.[1]) return match[1].trim()
    }
    return null
  }

  private extractHeadBranch(task: string): string | null {
    const match = task.match(/(?:from|head|source)\s*[`'"]?([\w.-]+)[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractBaseBranch(task: string): string | null {
    const match = task.match(/(?:to|into|base|target)\s*[`'"]?([\w.-]+)[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractRepoName(task: string): string | null {
    const match = task.match(/(?:repo|repository)\s*(?:called|named)?\s*[`'"]?([\w.-]+)[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractLabels(task: string): string[] {
    const patterns = [
      /(?:labels?|tags?)\s*[:=]\s*\[([^\]]+)\]/i,
      /(?:labels?|tags?)\s*[:=]\s*[`'"]?(.+?)[`'"]?(?:\s|$)/i,
    ]

    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match) {
        return match[1]!.split(/[,;]/).map(l => l.trim().replace(/['"]/g, '')).filter(Boolean)
      }
    }
    return []
  }

  private extractMergeMethod(task: string): 'merge' | 'squash' | 'rebase' {
    if (/squash/i.test(task)) return 'squash'
    if (/rebase/i.test(task)) return 'rebase'
    return 'merge'
  }

  private extractDefaultRepo(): string {
    try {
      const pkg = require(process.cwd() + '/package.json')
      const repoUrl: string = pkg.repository?.url ?? ''
      const match = repoUrl.match(/github\.com[:/]([\w-]+\/[\w.-]+)/)
      return match?.[1] ?? 'unknown/unknown'
    } catch {
      return 'unknown/unknown'
    }
  }
}
