import { BaseAgent } from '../base'
import type { AgentMessage } from '@chakravyuh/core'
import { AgentError } from '@chakravyuh/core/errors'

interface TestResult {
  testName: string
  status: 'passed' | 'failed' | 'skipped' | 'error'
  durationMs: number
  error?: string
  output?: string
}

interface TestSuiteResult {
  suiteName: string
  totalTests: number
  passed: number
  failed: number
  skipped: number
  durationMs: number
  results: TestResult[]
  coverage?: CoverageReport
}

interface CoverageReport {
  lines: { total: number; covered: number; percentage: number }
  branches: { total: number; covered: number; percentage: number }
  functions: { total: number; covered: number; percentage: number }
}

interface ValidationCheck {
  name: string
  passed: boolean
  message: string
  severity: 'error' | 'warning' | 'info'
}

export class QAAgent extends BaseAgent {
  private testHistory = new Map<string, TestSuiteResult>()
  private recentValidations: ValidationCheck[] = []

  async onStart(): Promise<void> {
    this.logger.info('QA agent ready')
  }

  async onMessage(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const context = message.payload.context ?? {}

    const normalized = task.toLowerCase()

    if (/\b(run|execute|trigger)\b/.test(normalized) && /\b(test|spec|suite)\b/.test(normalized)) {
      return this.handleRunTests(message)
    }

    if (/\b(write|create|generate)\b/.test(normalized) && /\b(test|spec)\b/.test(normalized)) {
      return this.handleWriteTests(message)
    }

    if (/\b(validate|verify|check|assert)\b/.test(normalized)) {
      return this.handleValidation(message)
    }

    if (/\b(coverage|code\s+coverage|test\s+coverage)\b/.test(normalized)) {
      return this.handleCoverage(message)
    }

    if (/\b(format|lint|style|prettier|eslint)\b/.test(normalized)) {
      return this.handleLint(message)
    }

    if (/\b(report|summary|results)\b/.test(normalized)) {
      return this.handleReport(message)
    }

    return this.handleGeneralQA(message)
  }

  async onError(error: Error, message: AgentMessage): Promise<void> {
    this.logger.error('QA error', { error: error.message, taskId: message.id })
  }

  private async handleRunTests(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const testPath = this.extractTestPath(task) ?? '.'

    this.logger.info('Running tests', { path: testPath })

    try {
      const result = await this.callTool('terminal', {
        command: `npx vitest run ${testPath} --reporter=json 2>&1 || npx jest ${testPath} --json 2>&1 || echo "No test runner found"`,
        timeout: this.config.limits.timeout,
      })

      const output = result as string
      const testResults = this.parseTestOutput(output, testPath)

      this.testHistory.set(testResults.suiteName, testResults)

      await this.storeProcedural(JSON.stringify(testResults, null, 2), { type: 'test_run', path: testPath })

      return this.reply(message, { data: testResults })
    } catch (error) {
      return this.reply(message, {
        data: {
          suiteName: testPath,
          totalTests: 0,
          passed: 0,
          failed: 1,
          skipped: 0,
          durationMs: 0,
          results: [],
          error: `Test execution failed: ${(error as Error).message}`,
        },
      })
    }
  }

  private async handleWriteTests(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const filePath = this.extractFilePath(task)
    const testFramework = this.detectTestFramework(task)

    if (!filePath) {
      return this.reply(message, { data: { error: 'No file path specified for test generation' } })
    }

    let sourceContent = ''
    try {
      sourceContent = (await this.callTool('filesystem', { operation: 'read', path: filePath })) as string
    } catch {
      this.logger.warn('Could not read source file, generating tests from description', { filePath })
    }

    const completion = await this.provider.complete({
      model: this.config.model,
      messages: [
        {
          role: 'system',
          content: `You are a QA engineer. Generate ${testFramework} tests for the given code. Include unit tests, edge cases, and error handling. Return ONLY the test code.`,
        },
        {
          role: 'user',
          content: sourceContent
            ? `Write ${testFramework} tests for this code:\n\n${sourceContent}`
            : `Write ${testFramework} tests for: ${task}`,
        },
      ],
      maxTokens: this.config.limits.maxTokensPerTask,
    })

    const testFilePath = this.generateTestFilePath(filePath)
    try {
      await this.callTool('filesystem', { operation: 'write', path: testFilePath, content: completion.content })
    } catch {
      this.logger.warn('Could not write test file, returning content instead')
    }

    return this.reply(message, {
      data: {
        sourceFile: filePath,
        testFile: testFilePath,
        framework: testFramework,
        code: completion.content,
      },
    })
  }

  private async handleValidation(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const checks = await this.runValidations(task)

    const allPassed = checks.every(c => c.passed)
    this.recentValidations = checks

    await this.storeProcedural(JSON.stringify(checks, null, 2), { type: 'validation' })

    return this.reply(message, {
      data: {
        allPassed,
        totalChecks: checks.length,
        passed: checks.filter(c => c.passed).length,
        failed: checks.filter(c => !c.passed).length,
        checks,
      },
    })
  }

  private async handleCoverage(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const testPath = this.extractTestPath(task) ?? '.'

    try {
      const result = await this.callTool('terminal', {
        command: `npx vitest run ${testPath} --coverage --reporter=json 2>&1 || npx jest ${testPath} --coverage --json 2>&1 || echo "Coverage not available"`,
        timeout: this.config.limits.timeout,
      })

      const output = result as string
      const coverage = this.parseCoverageOutput(output)

      return this.reply(message, { data: coverage })
    } catch (error) {
      return this.reply(message, { data: { error: `Coverage failed: ${(error as Error).message}` } })
    }
  }

  private async handleLint(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const filePath = this.extractFilePath(task) ?? '.'

    try {
      const result = await this.callTool('terminal', {
        command: `npx eslint ${filePath} --format json 2>&1 || npx prettier --check ${filePath} 2>&1 || echo "Lint not available"`,
        timeout: this.config.limits.timeout,
      })

      return this.reply(message, { data: { lintOutput: result, filePath } })
    } catch (error) {
      return this.reply(message, { data: { error: `Lint failed: ${(error as Error).message}` } })
    }
  }

  private async handleReport(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const suiteName = this.extractTestPath(task)

    if (suiteName && this.testHistory.has(suiteName)) {
      return this.reply(message, { data: this.testHistory.get(suiteName) })
    }

    const recentTests = [...this.testHistory.values()].slice(-5).map(r => ({
      suite: r.suiteName,
      passed: r.passed,
      failed: r.failed,
      total: r.totalTests,
    }))

    const summary = {
      totalSuites: this.testHistory.size,
      recentTests,
      recentValidations: this.recentValidations.slice(-5),
      overallHealth: this.calculateOverallHealth(),
    }

    return this.reply(message, { data: summary })
  }

  private async handleGeneralQA(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''

    const validationChecks = await this.runValidations(task)

    return this.reply(message, {
      data: {
        type: 'general_qa',
        task,
        checks: validationChecks,
        passed: validationChecks.filter(c => c.passed).length,
        total: validationChecks.length,
      },
    })
  }

  private async runValidations(task: string): Promise<ValidationCheck[]> {
    const checks: ValidationCheck[] = []

    const filePatterns = [
      { ext: 'ts', name: 'TypeScript' },
      { ext: 'js', name: 'JavaScript' },
      { ext: 'py', name: 'Python' },
      { ext: 'json', name: 'JSON' },
      { ext: 'yaml', name: 'YAML' },
      { ext: 'md', name: 'Markdown' },
    ]

    for (const { ext, name } of filePatterns) {
      if (task.includes(`.${ext}`)) {
        try {
          const content = await this.callTool('filesystem', {
            operation: 'read',
            path: task.match(new RegExp(`[\\w./-]+\\.${ext}`))?.[0] ?? '',
          })
          checks.push({
            name: `${name} file is readable`,
            passed: typeof content === 'string',
            message: `Successfully read ${name} file`,
            severity: 'error',
          })
        } catch {
          checks.push({
            name: `${name} file exists`,
            passed: false,
            message: `Could not read ${name} file`,
            severity: 'error',
          })
        }
      }
    }

    checks.push({
      name: 'Task has content',
      passed: task.length > 0,
      message: task.length > 0 ? `Task length: ${task.length} chars` : 'Empty task',
      severity: 'error',
    })

    checks.push({
      name: 'Task length is reasonable',
      passed: task.length < 50000,
      message: task.length < 50000 ? `Task size OK (${task.length} chars)` : 'Task too large (>50KB)',
      severity: 'warning',
    })

    return checks
  }

  private parseTestOutput(output: string, testPath: string): TestSuiteResult {
    try {
      const parsed = JSON.parse(output)
      if (parsed.numTotalTests !== undefined) {
        return {
          suiteName: testPath,
          totalTests: parsed.numTotalTests ?? 0,
          passed: parsed.numPassedTests ?? 0,
          failed: parsed.numFailedTests ?? 0,
          skipped: parsed.numPendingTests ?? 0,
          durationMs: parsed.testResults?.reduce((acc: number, r: { duration?: number }) => acc + (r.duration ?? 0), 0) ?? 0,
          results: (parsed.testResults ?? []).flatMap((suite: { assertionResults?: Array<{ title: string; status: string; duration?: number; failureMessages?: string[] }> }) =>
            (suite.assertionResults ?? []).map((t: { title: string; status: string; duration?: number; failureMessages?: string[] }) => ({
              testName: t.title,
              status: t.status === 'passed' ? 'passed' as const : 'failed' as const,
              durationMs: t.duration ?? 0,
              error: t.failureMessages?.[0],
            }))
          ),
        }
      }
    } catch {}

    const passedMatch = output.match(/(\d+)\s+passed/)
    const failedMatch = output.match(/(\d+)\s+failed/)
    const totalMatch = output.match(/Tests:\s+(\d+)/)

    return {
      suiteName: testPath,
      totalTests: totalMatch ? parseInt(totalMatch[1]!, 10) : 0,
      passed: passedMatch ? parseInt(passedMatch[1]!, 10) : 0,
      failed: failedMatch ? parseInt(failedMatch[1]!, 10) : 0,
      skipped: 0,
      durationMs: 0,
      results: [],
    }
  }

  private parseCoverageOutput(output: string): CoverageReport {
    try {
      const parsed = JSON.parse(output)
      if (parsed.coverageMap) {
        const pct = (covered: number, total: number) => total > 0 ? Math.round((covered / total) * 100) : 0
        return {
          lines: { total: 0, covered: 0, percentage: 0 },
          branches: { total: 0, covered: 0, percentage: 0 },
          functions: { total: 0, covered: 0, percentage: 0 },
        }
      }
    } catch {}

    const linePct = output.match(/Lines\s*:\s*([\d.]+)%/)
    const branchPct = output.match(/Branches\s*:\s*([\d.]+)%/)
    const funcPct = output.match(/Functions\s*:\s*([\d.]+)%/)

    return {
      lines: { total: 0, covered: 0, percentage: linePct ? parseFloat(linePct[1]!) : 0 },
      branches: { total: 0, covered: 0, percentage: branchPct ? parseFloat(branchPct[1]!) : 0 },
      functions: { total: 0, covered: 0, percentage: funcPct ? parseFloat(funcPct[1]!) : 0 },
    }
  }

  private calculateOverallHealth(): string {
    const results = [...this.testHistory.values()]
    if (results.length === 0) return 'unknown'

    const totalPassed = results.reduce((acc, r) => acc + r.passed, 0)
    const totalTests = results.reduce((acc, r) => acc + r.totalTests, 0)
    const passRate = totalTests > 0 ? totalPassed / totalTests : 0

    if (passRate >= 0.9) return 'excellent'
    if (passRate >= 0.7) return 'good'
    if (passRate >= 0.5) return 'needs_improvement'
    return 'critical'
  }

  private extractTestPath(task: string): string | null {
    const patterns = [
      /(?:test|spec|suite)\s*(?:path|file|at)?\s*[`'"]?([\/\\][\w.\\/\\-]+)[`'"]?/i,
      /(?:test|spec|suite)\s*(?:path|file|at)?\s*[`'"]?(\.[\/\\][\w.\\/\\-]+)[`'"]?/i,
      /[`'"]?(tests\/[\w.\/\\-]+)[`'"]?/i,
    ]

    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match?.[1]) return match[1]
    }
    return null
  }

  private extractFilePath(task: string): string | null {
    const patterns = [
      /(?:file|path|at)\s*[`'"]?([\/\\][\w.\\/\\-]+(?:\.[a-zA-Z]+))[`'"]?/i,
      /(?:file|path|at)\s*[`'"]?(\.[\/\\][\w.\\/\\-]+(?:\.[a-zA-Z]+))[`'"]?/i,
      /[`'"]?([\w-]+\/(?:[\w.-]+\/)*[\w.-]+\.[a-zA-Z]+)[`'"]?/i,
    ]

    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match?.[1]) return match[1]
    }
    return null
  }

  private detectTestFramework(task: string): string {
    const lower = task.toLowerCase()
    if (/vitest/i.test(lower)) return 'vitest'
    if (/jest/i.test(lower)) return 'jest'
    if (/mocha/i.test(lower)) return 'mocha'
    if (/cypress/i.test(lower)) return 'cypress'
    if (/playwright/i.test(lower)) return 'playwright'
    if (/pytest/i.test(lower)) return 'pytest'

    const ext = this.extractFilePath(task)?.split('.').pop()
    if (ext === 'ts' || ext === 'tsx') return 'vitest'
    if (ext === 'js' || ext === 'jsx') return 'jest'
    if (ext === 'py') return 'pytest'
    return 'vitest'
  }

  private generateTestFilePath(sourcePath: string): string {
    const parts = sourcePath.split('/')
    const fileName = parts.pop() ?? 'unknown'
    const dir = parts.join('/')
    const baseName = fileName.replace(/\.[^.]+$/, '')

    if (fileName.includes('.test.') || fileName.includes('.spec.')) {
      return sourcePath
    }

    const ext = fileName.split('.').pop()
    return dir ? `${dir}/${baseName}.test.${ext}` : `${baseName}.test.${ext}`
  }
}
