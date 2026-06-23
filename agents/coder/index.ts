import { BaseAgent } from '../base'
import type { AgentMessage } from '@chakravyuh/core'
import { AgentError } from '@chakravyuh/core/errors'

interface FileSpec {
  path: string
  content?: string
  language?: string
}

interface CodeReviewResult {
  filePath: string
  issues: CodeIssue[]
  score: number
  summary: string
}

interface CodeIssue {
  line: number
  severity: 'error' | 'warning' | 'info'
  message: string
  suggestion?: string
}

interface RefactorPlan {
  filePath: string
  changes: Array<{ description: string; priority: 'high' | 'medium' | 'low' }>
  estimatedImpact: string
}

export class CoderAgent extends BaseAgent {
  private recentFiles = new Map<string, string>()
  private reviewHistory: CodeReviewResult[] = []

  async onStart(): Promise<void> {
    this.logger.info('Coder agent ready')
  }

  async onMessage(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const context = message.payload.context ?? {}

    const normalized = task.toLowerCase()

    if (/\b(review|audit|inspect|check\s+code)\b/.test(normalized)) {
      return this.handleReview(message)
    }

    if (/\b(refactor|clean|optimize|improve|restructure)\b/.test(normalized)) {
      return this.handleRefactor(message)
    }

    if (/\b(read|open|get|cat|show|display)\b/.test(normalized) && /\b(file)\b/.test(normalized)) {
      return this.handleReadFile(message)
    }

    if (/\b(write|create|save|generate)\b/.test(normalized) && /(file|code|script|module|class)/.test(normalized)) {
      return this.handleWriteFile(message)
    }

    if (/\b(delete|remove|rm)\b/.test(normalized) && /\b(file)\b/.test(normalized)) {
      return this.handleDeleteFile(message)
    }

    if (/\b(list|ls|dir|directory|folder)\b/.test(normalized)) {
      return this.handleListFiles(message)
    }

    return this.handleGeneralCodeTask(message)
  }

  async onError(error: Error, message: AgentMessage): Promise<void> {
    this.logger.error('Coder error', { error: error.message, taskId: message.id })

    if (error instanceof AgentError && error.code === 'TOOL_ERROR') {
      this.logger.warn('Tool error, attempting fallback', { taskId: message.id })
    }
  }

  private async handleReview(message: AgentMessage): Promise<AgentMessage> {
    const filePath = this.extractFilePath(message.payload.task ?? '')
    if (!filePath) {
      return this.reply(message, { data: { error: 'No file path specified for review' } })
    }

    const content = await this.readFileContent(filePath)
    const issues = this.analyzeCode(content, filePath)
    const score = this.calculateQualityScore(issues)

    const result: CodeReviewResult = {
      filePath,
      issues,
      score,
      summary: `Reviewed ${filePath}: ${issues.length} issues found (${issues.filter(i => i.severity === 'error').length} errors, ${issues.filter(i => i.severity === 'warning').length} warnings). Quality score: ${score}/100`,
    }

    this.reviewHistory.push(result)
    await this.storeProcedural(JSON.stringify(result, null, 2), { type: 'code_review', filePath })

    return this.reply(message, { data: result })
  }

  private async handleRefactor(message: AgentMessage): Promise<AgentMessage> {
    const filePath = this.extractFilePath(message.payload.task ?? '')
    if (!filePath) {
      return this.reply(message, { data: { error: 'No file path specified for refactor' } })
    }

    const content = await this.readFileContent(filePath)
    const issues = this.analyzeCode(content, filePath)
    const refactorPlan = this.createRefactorPlan(filePath, issues)

    return this.reply(message, { data: refactorPlan })
  }

  private async handleReadFile(message: AgentMessage): Promise<AgentMessage> {
    const filePath = this.extractFilePath(message.payload.task ?? '')
    if (!filePath) {
      return this.reply(message, { data: { error: 'No file path specified' } })
    }

    try {
      const content = await this.callTool('filesystem', { operation: 'read', path: filePath })
      this.recentFiles.set(filePath, content as string)
      return this.reply(message, { data: { path: filePath, content, length: (content as string).length } })
    } catch (error) {
      return this.reply(message, { data: { error: `Failed to read file: ${(error as Error).message}` } })
    }
  }

  private async handleWriteFile(message: AgentMessage): Promise<AgentMessage> {
    const files = this.extractFiles(message.payload.task ?? '')
    const results: Array<{ path: string; status: string; error?: string }> = []

    for (const file of files) {
      try {
        await this.callTool('filesystem', {
          operation: 'write',
          path: file.path,
          content: file.content,
        })
        this.recentFiles.set(file.path, file.content ?? '')
        results.push({ path: file.path, status: 'written' })

        this.logger.info('File written', { path: file.path, language: file.language })
      } catch (error) {
        results.push({ path: file.path, status: 'error', error: (error as Error).message })
      }
    }

    return this.reply(message, { data: { files: results } })
  }

  private async handleDeleteFile(message: AgentMessage): Promise<AgentMessage> {
    const filePath = this.extractFilePath(message.payload.task ?? '')
    if (!filePath) {
      return this.reply(message, { data: { error: 'No file path specified' } })
    }

    try {
      await this.callTool('filesystem', { operation: 'delete', path: filePath })
      this.recentFiles.delete(filePath)
      return this.reply(message, { data: { path: filePath, status: 'deleted' } })
    } catch (error) {
      return this.reply(message, { data: { error: `Failed to delete: ${(error as Error).message}` } })
    }
  }

  private async handleListFiles(message: AgentMessage): Promise<AgentMessage> {
    const dirPath = this.extractDirPath(message.payload.task ?? '') || '.'
    try {
      const listing = await this.callTool('filesystem', { operation: 'list', path: dirPath })
      return this.reply(message, { data: { path: dirPath, files: listing } })
    } catch (error) {
      return this.reply(message, { data: { error: `Failed to list: ${(error as Error).message}` } })
    }
  }

  private async handleGeneralCodeTask(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''

    const context = await this.getRelevantMemories(task, 3)
    const memoryContext = context.map(m => m.content).join('\n')

    const completion = await this.provider.complete({
      model: this.config.model,
      messages: [
        { role: 'system', content: 'You are a code writing assistant. Generate production-ready code with proper error handling. Respond with ONLY the code and a brief explanation.' },
        { role: 'user', content: memoryContext ? `Context from memory:\n${memoryContext}\n\nTask: ${task}` : task },
      ],
      maxTokens: this.config.limits.maxTokensPerTask,
    })

    return this.reply(message, { data: { code: completion.content } })
  }

  private async readFileContent(filePath: string): Promise<string> {
    if (this.recentFiles.has(filePath)) {
      return this.recentFiles.get(filePath)!
    }
    try {
      const content = await this.callTool('filesystem', { operation: 'read', path: filePath })
      return content as string
    } catch {
      return `// Could not read ${filePath}`
    }
  }

  private analyzeCode(content: string, filePath: string): CodeIssue[] {
    const issues: CodeIssue[] = []
    const lines = content.split('\n')
    const ext = filePath.split('.').pop()?.toLowerCase()

    const commentPattern = ext === 'py' ? '#' : ext === 'html' ? '<!--' : '//'

    lines.forEach((line, i) => {
      const lineNum = i + 1

      if (line.length > 200) {
        issues.push({ line: lineNum, severity: 'warning', message: 'Line exceeds 200 characters', suggestion: 'Break line into multiple lines' })
      }

      if (/TODO/i.test(line) && !line.includes(commentPattern)) {
        issues.push({ line: lineNum, severity: 'info', message: 'Unresolved TODO', suggestion: 'Address or remove TODO' })
      }

      if (/FIXME/i.test(line) && !line.includes(commentPattern)) {
        issues.push({ line: lineNum, severity: 'warning', message: 'FIXME marker found', suggestion: 'Fix the issue' })
      }

      if (/(password|secret|api_key|token)\s*[:=]\s*['"][^'"]+['"]/i.test(line)) {
        issues.push({ line: lineNum, severity: 'error', message: 'Possible hardcoded secret', suggestion: 'Use environment variables' })
      }

      if (line.trim().startsWith('console.log')) {
        issues.push({ line: lineNum, severity: 'info', message: 'Debug console.log detected', suggestion: 'Remove before production' })
      }

      if (line.includes('\t')) {
        issues.push({ line: lineNum, severity: 'warning', message: 'Tab character detected; use spaces', suggestion: 'Replace tabs with spaces' })
      }

      if (line.trimEnd().length !== line.length) {
        issues.push({ line: lineNum, severity: 'info', message: 'Trailing whitespace', suggestion: 'Remove trailing whitespace' })
      }
    })

    if (content.length > 10000) {
      issues.push({ line: 1, severity: 'warning', message: 'File is very large (>10KB)', suggestion: 'Consider splitting into modules' })
    }

    return issues
  }

  private calculateQualityScore(issues: CodeIssue[]): number {
    const errorCount = issues.filter(i => i.severity === 'error').length
    const warningCount = issues.filter(i => i.severity === 'warning').length
    const infoCount = issues.filter(i => i.severity === 'info').length

    let score = 100
    score -= errorCount * 15
    score -= warningCount * 5
    score -= infoCount * 2
    return Math.max(0, Math.min(100, score))
  }

  private createRefactorPlan(filePath: string, issues: CodeIssue[]): RefactorPlan {
    const changes = issues
      .filter(i => i.severity !== 'info')
      .map(i => ({
        description: `Line ${i.line}: ${i.message}`,
        priority: i.severity === 'error' ? 'high' as const : 'medium' as const,
      }))

    if (changes.length === 0) {
      changes.push({ description: 'No critical issues found; minor cleanup only', priority: 'low' })
    }

    return {
      filePath,
      changes,
      estimatedImpact: changes.some(c => c.priority === 'high') ? 'Significant changes needed' : 'Minor cleanup',
    }
  }

  private extractFilePath(task: string): string | null {
    const patterns = [
      /(?:file|path|at)?\s*[`'"]?([\/\\][\w.\\/\\-]+(?:\.[a-zA-Z]+))[`'"]?/i,
      /(?:file|path|at)?\s*[`'"]?(\.[\/\\][\w.\\/\\-]+(?:\.[a-zA-Z]+))[`'"]?/i,
      /(?:file|path|at)?\s*[`'"]?([\w-]+\/(?:[\w.-]+\/)*[\w.-]+\.[a-zA-Z]+)[`'"]?/i,
    ]

    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match?.[1]) return match[1]
    }
    return null
  }

  private extractDirPath(task: string): string | null {
    const match = task.match(/(?:directory|folder|dir|path)?\s*[`'"]?([\/\\]?[\w.\\/\\-]+)[`'"]?/i)
    return match?.[1] ?? null
  }

  private extractFiles(task: string): FileSpec[] {
    const files: FileSpec[] = []

    const fileBlocks = task.split(/(?=File:|###|```)/)
    for (const block of fileBlocks) {
      const pathMatch = block.match(/(?:file|path)\s*[:=]\s*[`'"]?([^`'"\n]+)[`'"]?/i)
      const langMatch = block.match(/```(\w+)/)
      const codeMatch = block.match(/```(?:\w+)?\n([\s\S]*?)```/)

      if (pathMatch?.[1]) {
        files.push({
          path: pathMatch[1].trim(),
          content: codeMatch?.[1]?.trim(),
          language: langMatch?.[1],
        })
      }
    }

    if (files.length === 0) {
      const wildGuess = this.extractFilePath(task)
      if (wildGuess) {
        files.push({ path: wildGuess, content: undefined })
      }
    }

    return files
  }
}
