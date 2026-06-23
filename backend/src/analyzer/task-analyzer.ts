import { logger } from '../logger.js'
import type { TaskAnalysis, ModelCapability } from '../types.js'

const KEYWORD_PATTERNS: Array<{
  types: TaskAnalysis['type'][]
  keywords: string[]
  capability: ModelCapability
}> = [
  {
    types: ['code'],
    keywords: ['write code', 'implement', 'function', 'class', 'refactor', 'debug', 'fix bug', 'create file', 'program', 'script', 'algorithm', 'api', 'endpoint', 'database query', 'sql', 'component', 'module'],
    capability: 'code',
  },
  {
    types: ['research'],
    keywords: ['research', 'find', 'search', 'look up', 'investigate', 'analyze', 'comparison', 'compare', 'what is', 'tell me about', 'explain', 'summarize', 'information'],
    capability: 'reasoning',
  },
  {
    types: ['browse'],
    keywords: ['browse', 'navigate', 'go to', 'open website', 'web page', 'scrape', 'crawl', 'website', 'url', 'http'],
    capability: 'vision',
  },
  {
    types: ['plan'],
    keywords: ['plan', 'strategy', 'roadmap', 'approach', 'architecture', 'design', 'blueprint', 'outline', 'steps', 'milestone'],
    capability: 'reasoning',
  },
  {
    types: ['test'],
    keywords: ['test', 'unit test', 'integration test', 'e2e', 'testing', 'assert', 'jest', 'mocha', 'vitest', 'coverage', 'qa'],
    capability: 'code',
  },
  {
    types: ['memory'],
    keywords: ['remember', 'store', 'recall', 'remember that', 'save', 'memorize', 'memory', 'forget', 'retrieve'],
    capability: 'embedding',
  },
  {
    types: ['security'],
    keywords: ['security', 'vulnerability', 'threat', 'attack', 'exploit', 'cve', 'audit', 'permission', 'auth', 'oauth', 'token', 'encrypt', 'malicious'],
    capability: 'reasoning',
  },
  {
    types: ['deploy'],
    keywords: ['deploy', 'release', 'publish', 'production', 'ci/cd', 'pipeline', 'docker', 'kubernetes', 'infrastructure', 'terraform', 'cloud', 'aws', 'azure', 'gcp'],
    capability: 'code',
  },
]

const COMPLEXITY_KEYWORDS: Record<string, RegExp> = {
  simple: /\b(simple|basic|quick|easy|trivial|small|minor|tiny)\b/i,
  moderate: /\b(moderate|medium|normal|standard|intermediate)\b/i,
  complex: /\b(complex|difficult|hard|advanced|complicated|massive|large|enterprise|sophisticated)\b/i,
}

const SENSITIVITY_KEYWORDS: Record<string, RegExp> = {
  normal: /\b(normal|public|standard)\b/i,
  sensitive: /\b(sensitive|confidential|private|internal)\b/i,
  critical: /\b(critical|secret|top.secret|classified|pii|password|credential|token|key)\b/i,
}

const TOKEN_ESTIMATES: Record<TaskAnalysis['complexity'], number> = {
  simple: 500,
  moderate: 2000,
  complex: 8000,
}

const TIMEOUT_ESTIMATES: Record<TaskAnalysis['complexity'], number> = {
  simple: 15_000,
  moderate: 60_000,
  complex: 180_000,
}

export class TaskAnalyzer {
  private classifyCount = 0

  analyze(input: string): TaskAnalysis {
    this.classifyCount++
    const lower = input.toLowerCase()

    const taskTypes = this.classifyType(lower)
    const complexity = this.classifyComplexity(lower)
    const requiredCapabilities = this.classifyCapabilities(lower, taskTypes)
    const estimatedTokens = TOKEN_ESTIMATES[complexity]
    const sensitivity = this.classifySensitivity(lower)
    const timeout = TIMEOUT_ESTIMATES[complexity]

    const taskType = this.pickBestType(taskTypes, lower)

    const analysis: TaskAnalysis = {
      type: taskType,
      complexity,
      requiredCapabilities,
      estimatedTokens,
      sensitivity,
      timeout,
    }

    logger.debug('Task analyzed', { source: 'TaskAnalyzer', input: input.slice(0, 100), analysis: JSON.stringify(analysis) })

    return analysis
  }

  private classifyType(lower: string): TaskAnalysis['type'][] {
    const matched = new Set<TaskAnalysis['type']>()

    for (const pattern of KEYWORD_PATTERNS) {
      for (const keyword of pattern.keywords) {
        if (lower.includes(keyword)) {
          for (const type of pattern.types) {
            matched.add(type)
          }
          break
        }
      }
    }

    if (matched.size === 0) {
      matched.add('research')
    }

    return Array.from(matched)
  }

  private pickBestType(types: TaskAnalysis['type'][], lower: string): TaskAnalysis['type'] {
    if (types.length === 1) return types[0]!

    const scores = new Map<TaskAnalysis['type'], number>()

    for (const type of types) {
      let score = 0
      for (const pattern of KEYWORD_PATTERNS) {
        if (pattern.types.includes(type)) {
          for (const keyword of pattern.keywords) {
            const occurrences = (lower.match(new RegExp(keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length
            score += occurrences
          }
        }
      }
      scores.set(type, score)
    }

    let bestType = types[0]!
    let bestScore = -1

    for (const [type, score] of scores) {
      if (score > bestScore) {
        bestScore = score
        bestType = type
      }
    }

    return bestType
  }

  private classifyComplexity(lower: string): TaskAnalysis['complexity'] {
    if (COMPLEXITY_KEYWORDS.simple.test(lower)) return 'simple'
    if (COMPLEXITY_KEYWORDS.complex.test(lower)) return 'complex'
    return 'moderate'
  }

  private classifyCapabilities(lower: string, types: TaskAnalysis['type'][]): ModelCapability[] {
    const caps = new Set<ModelCapability>()

    for (const type of types) {
      for (const pattern of KEYWORD_PATTERNS) {
        if (pattern.types.includes(type)) {
          caps.add(pattern.capability)
        }
      }
    }

    caps.add('chat')

    return Array.from(caps)
  }

  private classifySensitivity(lower: string): TaskAnalysis['sensitivity'] {
    if (SENSITIVITY_KEYWORDS.critical.test(lower)) return 'critical'
    if (SENSITIVITY_KEYWORDS.sensitive.test(lower)) return 'sensitive'
    return 'normal'
  }

  estimateTokens(input: string, complexity: TaskAnalysis['complexity']): number {
    const rawTokens = Math.ceil(input.length / 4)
    const multiplier = complexity === 'simple' ? 1 : complexity === 'moderate' ? 2 : 4
    return Math.max(rawTokens * multiplier, TOKEN_ESTIMATES[complexity])
  }

  getClassificationCount(): number {
    return this.classifyCount
  }
}
