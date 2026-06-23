export interface ModelInfo {
  id: string
  context: number
  capabilities: string[]
  cost: {
    input: number
    output: number
  }
}

export interface ContentPart {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

export interface Message {
  role: 'system' | 'user' | 'assistant'
  content: string | ContentPart[]
}

export interface CompletionRequest {
  model: string
  messages: Message[]
  temperature?: number
  maxTokens?: number
  stop?: string | string[]
  stream?: boolean
}

export interface Choice {
  index: number
  message: Message
  finishReason: 'stop' | 'length' | 'error' | null
}

export interface CompletionResponse {
  id: string
  model: string
  choices: Choice[]
  usage?: Usage
}

export interface ChunkChoice {
  index: number
  delta: {
    content?: string
    role?: string
  }
  finishReason: 'stop' | 'length' | null
}

export interface CompletionChunk {
  id: string
  model: string
  choices: ChunkChoice[]
}

export interface Usage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

export interface LLMProvider {
  id: string
  name: string
  models: ModelInfo[]
  complete(req: CompletionRequest): Promise<CompletionResponse>
  stream?(req: CompletionRequest): AsyncIterable<CompletionChunk>
  embed?(input: string[]): Promise<number[][]>
}

export interface ProviderConfig {
  enabled: boolean
  priority: number
  models: ModelInfo[]
  defaults?: {
    temperature?: number
    maxTokens?: number
  }
  baseUrl?: string
}

export type ProviderErrorCode =
  | 'rate_limit'
  | 'auth'
  | 'timeout'
  | 'bad_request'
  | 'server_error'
  | 'unknown'

export type MemoryType = 'working' | 'episodic' | 'semantic' | 'procedural'

export interface MemoryEntry {
  id: string
  type: MemoryType
  agentId: string
  content: string
  embedding?: number[]
  metadata: Record<string, unknown>
  createdAt: string
  expiresAt?: string
}

export interface RoutingStrategy {
  type: 'fixed' | 'fallback' | 'capability' | 'cheapest' | 'fastest' | 'ensemble'
  provider?: string
  model?: string
  minCapability?: string
  prefer?: string[]
  preferCheapest?: boolean
  fallbacks?: string[]
}

export interface AgentLimits {
  maxTokensPerTask: number
  maxConsecutiveCalls: number
  timeout: number
}

export interface AgentConfig {
  id: string
  name: string
  role: string
  systemPrompt: string
  provider: string | RoutingStrategy
  model: string
  tools: string[]
  memoryScope: MemoryType[]
  allowedPeers: string[]
  limits: AgentLimits
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    lastHeartbeat: string
    errorCount: number
  }
}

export interface AgentMessage {
  id: string
  from: string
  to: string | string[]
  type: 'request' | 'response' | 'broadcast' | 'error'
  priority: 'low' | 'medium' | 'high' | 'critical'
  payload: {
    task?: string
    data?: unknown
    context?: Record<string, unknown>
  }
  metadata: {
    timestamp: string
    ttl: number
    traceId: string
    parentId?: string
    correlationId?: string
  }
}

export interface TaskAnalysis {
  type: 'code' | 'research' | 'browse' | 'plan' | 'test' | 'memory' | 'security' | 'deploy'
  complexity: 'simple' | 'moderate' | 'complex'
  requiredCapabilities: string[]
  estimatedTokens: number
  sensitivity: 'normal' | 'sensitive' | 'critical'
  timeout: number
}

export interface RoutingDecision {
  provider: string
  model: string
  confidence: number
  estimatedCost: number
  estimatedLatencyMs: number
  alternatives: Array<{ provider: string; model: string }>
}

export interface WorkflowGate {
  type: 'condition' | 'human_approval'
  expression?: string
  message?: string
}

export interface WorkflowStep {
  id: string
  agent: string
  task: string
  depends_on?: string[]
  parallel?: boolean
  output?: string
  gates?: WorkflowGate[]
}

export interface WorkflowDefinition {
  id: string
  version: string
  description: string
  maxRetries: number
  onFailure: 'notify_human' | 'abort' | 'skip'
  steps: WorkflowStep[]
}

export interface Tool {
  id: string
  name: string
  description: string
  execute(args: unknown): Promise<unknown>
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: ProviderErrorCode = 'unknown',
  ) {
    super(message)
    this.name = 'ProviderError'
  }
}
