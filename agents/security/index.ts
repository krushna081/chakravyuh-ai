import { BaseAgent } from '../base'
import type { AgentMessage } from '@chakravyuh/core'
import { AgentError } from '@chakravyuh/core/errors'

interface VulnerabilityFinding {
  type: 'injection' | 'xss' | 'sql_injection' | 'path_traversal' | 'command_injection' | 'hardcoded_secret' | 'insecure_crypto' | 'improper_auth' | 'information_disclosure' | 'known_vulnerability'
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info'
  file?: string
  line?: number
  code?: string
  description: string
  recommendation: string
  cweId?: string
}

interface SecurityAuditResult {
  target: string
  findings: VulnerabilityFinding[]
  summary: {
    critical: number
    high: number
    medium: number
    low: number
    info: number
    total: number
  }
  score: number
  passed: boolean
}

interface PromptInjectionAnalysis {
  riskLevel: 'safe' | 'suspicious' | 'dangerous'
  indicators: string[]
  sanitizedInput?: string
  explanation: string
}

export class SecurityAgent extends BaseAgent {
  private auditHistory = new Map<string, SecurityAuditResult>()
  private readonly sensitivePatterns = [
    /(?:sk|pk)_(?:test_|live_)?[a-zA-Z0-9]{20,40}/gi,
    /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}/g,
    /AKIA[0-9A-Z]{16}/g,
    /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/,
    /(?:password|passwd|pwd)\s*[:=]\s*\S+/i,
    /(?:api[_-]?key|apikey)\s*[:=]\s*\S+/i,
    /(?:secret|token|credential)\s*[:=]\s*\S+/i,
    /(?:eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)/g,
  ]

  private readonly injectionPatterns = [
    /[\b(?:')?\s*OR\s*['\d]+\s*=\s*['\d]+\b/i,
    /<script[\s>]/i,
    /javascript\s*:/i,
    /on\w+\s*=\s*['"]/i,
    /\.\.\/\.\.\//,
    /;\s*(?:rm|del|drop|truncate|shutdown|format)\s/i,
    /`[\s\S]*`/,
    /\$\{[\s\S]*\}/,
  ]

  async onStart(): Promise<void> {
    this.logger.info('Security agent ready')
  }

  async onMessage(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const data = message.payload.data as Record<string, unknown> | undefined

    const normalized = task.toLowerCase()

    if (/\b(audit|scan|review|analyze)\b/.test(normalized) && /\b(code|file|repo|repository|project)\b/.test(normalized)) {
      return this.handleAudit(message)
    }

    if (/\b(injection|prompt.?injection|detect|sanitize)\b/.test(normalized)) {
      return this.handlePromptInjection(message)
    }

    if (/\b(secret|credential|key|token|leak)\b/.test(normalized)) {
      return this.handleSecretDetection(message)
    }

    if (/\b(dependency|vulnerability|cve|supply.?chain)\b/.test(normalized)) {
      return this.handleDependencyCheck(message)
    }

    if (/\b(config|configuration|misconfig|hardening)\b/.test(normalized)) {
      return this.handleConfigAudit(message)
    }

    if (data?.code || data?.content) {
      return this.handleAudit(message)
    }

    return this.handleGeneralSecurityCheck(message)
  }

  async onError(error: Error, message: AgentMessage): Promise<void> {
    this.logger.error('Security error', { error: error.message, taskId: message.id })
  }

  private async handleAudit(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const data = message.payload.data as Record<string, unknown> | undefined
    const target = data?.file as string ?? data?.path as string ?? this.extractFilePath(task) ?? 'unknown'
    const code = data?.code as string ?? data?.content as string

    this.logger.info('Security audit', { target })

    let content = code
    if (!content && target !== 'unknown') {
      try {
        content = (await this.callTool('filesystem', { operation: 'read', path: target })) as string
      } catch {
        this.logger.warn('Could not read file for audit', { target })
      }
    }

    const findings: VulnerabilityFinding[] = []

    if (content) {
      findings.push(...this.scanForSecrets(content, target))
      findings.push(...this.scanForCodeVulnerabilities(content, target))
      findings.push(...this.scanForInsecurePatterns(content, target))
    }

    const summary = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length,
      info: findings.filter(f => f.severity === 'info').length,
      total: findings.length,
    }

    const score = this.calculateSecurityScore(summary)
    const result: SecurityAuditResult = {
      target,
      findings,
      summary,
      score,
      passed: score >= 70,
    }

    this.auditHistory.set(target, result)

    await this.storeProcedural(JSON.stringify(result, null, 2), { type: 'security_audit', target })

    return this.reply(message, { data: result })
  }

  private async handlePromptInjection(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const data = message.payload.data as Record<string, unknown> | undefined
    const input = data?.input as string ?? data?.text as string ?? task

    const analysis = this.analyzePromptInjection(input)

    if (analysis.riskLevel === 'dangerous') {
      this.logger.warn('Prompt injection detected', { indicators: analysis.indicators })
      this.broadcast('security.threat.prompt_injection', {
        indicators: analysis.indicators,
        inputPreview: input.slice(0, 100),
      })
    }

    return this.reply(message, { data: analysis })
  }

  private async handleSecretDetection(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const data = message.payload.data as Record<string, unknown> | undefined
    const content = data?.content as string ?? data?.text as string ?? task

    const findings = this.scanForSecrets(content, 'input')
    const secretsFound = findings.filter(f => f.type === 'hardcoded_secret')

    return this.reply(message, {
      data: {
        secretsFound: secretsFound.length,
        findings: secretsFound,
        safe: secretsFound.length === 0,
      },
    })
  }

  private async handleDependencyCheck(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const manifestPath = this.extractFilePath(task) ?? 'package.json'

    try {
      const manifestContent = await this.callTool('filesystem', { operation: 'read', path: manifestPath }) as string
      const manifest = JSON.parse(manifestContent)
      const deps = { ...manifest.dependencies, ...manifest.devDependencies } as Record<string, string>

      const findings: VulnerabilityFinding[] = []
      for (const [name, version] of Object.entries(deps)) {
        const cleanVersion = (version as string).replace(/[\^~]/g, '')
        if (cleanVersion === '*' || cleanVersion === 'latest') {
          findings.push({
            type: 'known_vulnerability',
            severity: 'medium',
            file: manifestPath,
            description: `Dependency "${name}" uses unpinned version "${version}"`,
            recommendation: `Pin "${name}" to a specific version`,
            cweId: 'CWE-1104',
          })
        }
      }

      return this.reply(message, {
        data: {
          manifest: manifestPath,
          totalDeps: Object.keys(deps).length,
          unpinnedDeps: findings.length,
          findings,
        },
      })
    } catch (error) {
      return this.reply(message, { data: { error: `Dependency check failed: ${(error as Error).message}` } })
    }
  }

  private async handleConfigAudit(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const configPath = this.extractFilePath(task) ?? '.env'

    try {
      const content = await this.callTool('filesystem', { operation: 'read', path: configPath }) as string
      const findings: VulnerabilityFinding[] = []

      const lines = content.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!
        for (const pattern of this.sensitivePatterns) {
          if (pattern.test(line) && !line.trim().startsWith('#')) {
            findings.push({
              type: 'hardcoded_secret',
              severity: 'critical',
              file: configPath,
              line: i + 1,
              description: `Potential secret exposed in config file: ${line.split('=')[0]?.trim()}`,
              recommendation: 'Use a secrets manager or environment variables',
            })
            break
          }
        }
      }

      return this.reply(message, {
        data: {
          configFile: configPath,
          secretsFound: findings.length,
          findings,
        },
      })
    } catch {
      return this.reply(message, { data: { error: 'Could not read config file' } })
    }
  }

  private async handleGeneralSecurityCheck(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''

    const injectionCheck = this.analyzePromptInjection(task)
    const secretFindings = this.scanForSecrets(task, 'task')

    return this.reply(message, {
      data: {
        taskAnalysis: {
          injectionRisk: injectionCheck.riskLevel,
          secretsFound: secretFindings.length,
          safe: injectionCheck.riskLevel === 'safe' && secretFindings.length === 0,
        },
        injectionAnalysis: injectionCheck,
        secretFindings,
        recommendations: this.generateRecommendations(injectionCheck, secretFindings),
      },
    })
  }

  private scanForSecrets(content: string, source: string): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = []
    const lines = content.split('\n')

    for (let i = 0; i < Math.min(lines.length, 500); i++) {
      const line = lines[i]!
      for (const pattern of this.sensitivePatterns) {
        const match = line.match(pattern)
        if (match) {
          findings.push({
            type: 'hardcoded_secret',
            severity: 'critical',
            file: source,
            line: i + 1,
            code: line.trim().replace(match[0], match[0].slice(0, 4) + '...' + match[0].slice(-4)),
            description: `Potential hardcoded secret: ${this.classifySecret(match[0])}`,
            recommendation: 'Remove hardcoded secrets. Use environment variables or a secrets manager.',
            cweId: 'CWE-798',
          })
          break
        }
      }
    }

    return findings
  }

  private scanForCodeVulnerabilities(content: string, source: string): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = []
    const lines = content.split('\n')
    const ext = source.split('.').pop()?.toLowerCase()

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!
      const lineNum = i + 1

      if (/(?:eval|exec)\s*\(/.test(line)) {
        findings.push({
          type: 'command_injection',
          severity: 'critical',
          file: source,
          line: lineNum,
          code: line.trim(),
          description: 'Use of eval()/exec() can lead to code injection',
          recommendation: 'Avoid eval/exec. Use safer alternatives like Function constructor or JSON parsing.',
          cweId: 'CWE-95',
        })
      }

      if (/innerHTML\s*=/.test(line) || /dangerouslySetInnerHTML/.test(line)) {
        findings.push({
          type: 'xss',
          severity: 'high',
          file: source,
          line: lineNum,
          code: line.trim(),
          description: 'Potential XSS vulnerability via innerHTML or dangerouslySetInnerHTML',
          recommendation: 'Use textContent or sanitize HTML input',
          cweId: 'CWE-79',
        })
      }

      if (/SELECT\s+.+\s+FROM\s+.+\s+WHERE\s+.+['"]\s*\+/.test(line)) {
        findings.push({
          type: 'sql_injection',
          severity: 'critical',
          file: source,
          line: lineNum,
          code: line.trim(),
          description: 'String concatenation in SQL query detected',
          recommendation: 'Use parameterized queries or prepared statements',
          cweId: 'CWE-89',
        })
      }

      if (/child_process\.exec(?:Sync)?\s*\(/.test(line) && !/\$/.test(line.split('(')[1] ?? '')) {
        findings.push({
          type: 'command_injection',
          severity: 'high',
          file: source,
          line: lineNum,
          code: line.trim(),
          description: 'Shell command execution detected',
          recommendation: 'Use execFile or spawn with arguments array instead of shell string',
          cweId: 'CWE-78',
        })
      }

      if (/Math\.random\s*\(\s*\)/.test(line)) {
        findings.push({
          type: 'insecure_crypto',
          severity: 'medium',
          file: source,
          line: lineNum,
          code: line.trim(),
          description: 'Math.random() used - not cryptographically secure',
          recommendation: 'Use crypto.randomBytes() or Web Crypto API for security-sensitive randomness',
          cweId: 'CWE-338',
        })
      }
    }

    return findings
  }

  private scanForInsecurePatterns(content: string, source: string): VulnerabilityFinding[] {
    const findings: VulnerabilityFinding[] = []

    if (/http:\/\//.test(content) && !/http:\/\/localhost/.test(content)) {
      findings.push({
        type: 'information_disclosure',
        severity: 'info',
        file: source,
        description: 'HTTP URLs detected (not HTTPS)',
        recommendation: 'Use HTTPS URLs instead of HTTP',
        cweId: 'CWE-319',
      })
    }

    if (/(?:allowlist|whitelist|blacklist|blocklist)/i.test(content)) {
      findings.push({
        type: 'improper_auth',
        severity: 'low',
        file: source,
        description: 'Hardcoded allow/block lists detected; consider dynamic configuration',
        recommendation: 'Use configurable allow/deny lists loaded from configuration',
        cweId: 'CWE-290',
      })
    }

    return findings
  }

  private analyzePromptInjection(input: string): PromptInjectionAnalysis {
    const indicators: string[] = []

    const directInjection = /(?:ignore|disregard|forget|override)\s+(?:all\s+)?(?:previous|above|system|instructions)/i
    if (directInjection.test(input)) {
      indicators.push('Attempts to override system instructions')
    }

    const roleChange = /(?:you\s+are\s+(?:now|not\s+)|act\s+as\s+|pretend\s+(?:to\s+)?be|from\s+now\s+on)/i
    if (roleChange.test(input)) {
      indicators.push('Attempts to change agent role/identity')
    }

    const delimiterBreak = /(?:===|---|```|"""|''').*(?:system|user|assistant|instruction|prompt)/i
    if (delimiterBreak.test(input)) {
      indicators.push('Attempts to break out of message context using delimiters')
    }

    const tokenTheft = /(?:output|print|show|display|reveal)\s+(?:the\s+)?(?:full\s+)?(?:prompt|instructions|system\s+message)/i
    if (tokenTheft.test(input)) {
      indicators.push('Attempts to extract system prompt')
    }

    const bypassAttempt = /(?:no\s+(?:restrictions?|limits?|rules?|filter)|bypass|jailbreak|dans|do\s+anything\s+now)/i
    if (bypassAttempt.test(input)) {
      indicators.push('Attempts to bypass content restrictions')
    }

    const xssAttempt = this.injectionPatterns.some(p => p.test(input))
    if (xssAttempt) {
      indicators.push('Potential XSS or injection payload detected')
    }

    let riskLevel: PromptInjectionAnalysis['riskLevel']
    if (indicators.length >= 2) {
      riskLevel = 'dangerous'
    } else if (indicators.length === 1) {
      riskLevel = 'suspicious'
    } else {
      riskLevel = 'safe'
    }

    const sanitized = riskLevel !== 'safe'
      ? input.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/[{}`$]/g, '')
      : undefined

    return {
      riskLevel,
      indicators,
      sanitizedInput: sanitized,
      explanation: indicators.length > 0
        ? `Found ${indicators.length} indicator(s): ${indicators.join('; ')}`
        : 'No injection indicators detected',
    }
  }

  private classifySecret(match: string): string {
    if (/^sk_/.test(match)) return 'Stripe secret key'
    if (/^pk_/.test(match)) return 'Stripe publishable key'
    if (/^gh[puors]_/.test(match)) return 'GitHub token'
    if (/^AKIA/.test(match)) return 'AWS access key'
    if (/^-----BEGIN/.test(match)) return 'Private key'
    if (/^eyJ/.test(match)) return 'JWT token'
    if (/password|passwd|pwd/i.test(match)) return 'Password'
    if (/api[_-]?key|apikey/i.test(match)) return 'API key'
    if (/secret/i.test(match)) return 'Secret'
    if (/token/i.test(match)) return 'Token'
    if (/credential/i.test(match)) return 'Credential'
    return 'Unknown secret pattern'
  }

  private calculateSecurityScore(summary: SecurityAuditResult['summary']): number {
    let score = 100
    score -= summary.critical * 30
    score -= summary.high * 15
    score -= summary.medium * 8
    score -= summary.low * 3
    score -= summary.info * 1
    return Math.max(0, Math.min(100, score))
  }

  private generateRecommendations(
    injectionAnalysis: PromptInjectionAnalysis,
    secretFindings: VulnerabilityFinding[],
  ): string[] {
    const recommendations: string[] = []

    if (injectionAnalysis.riskLevel !== 'safe') {
      recommendations.push('Sanitize user inputs before processing')
      recommendations.push('Implement input validation and content filtering')
    }

    if (secretFindings.length > 0) {
      recommendations.push('Remove hardcoded secrets and use environment variables')
      recommendations.push('Implement a secrets scanning pre-commit hook')
    }

    if (recommendations.length === 0) {
      recommendations.push('No security issues detected')
    }

    return recommendations
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
}
