import type { AgentConfig, AgentMessage, Tool, TaskAnalysis, LLMProvider, MemoryEntry } from '@chakravyuh/core'
import type { EventBus, EventEnvelope } from '@chakravyuh/core/events/event-bus'
import type { Logger } from '@chakravyuh/core/logger'
import { AgentError, TimeoutError } from '@chakravyuh/core/errors'
import { randomUUID } from 'node:crypto'

export interface AgentDependencies {
  provider: LLMProvider
  tools: Map<string, Tool>
  memory: MemoryManager
  eventBus: EventBus
  logger: Logger
}

export interface MemoryManager {
  store(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<MemoryEntry>
  search(type: string, query: string, limit?: number): Promise<MemoryEntry[]>
  recall(id: string): Promise<MemoryEntry | null>
  forget(id: string): Promise<boolean>
}

export abstract class BaseAgent {
  id: string
  name: string
  role: string
  config: AgentConfig
  protected provider: LLMProvider
  protected tools: Map<string, Tool>
  protected memory: MemoryManager
  protected eventBus: EventBus
  protected logger: Logger
  protected running = false
  protected consecutiveCalls = 0
  protected taskCounter = 0

  constructor(config: AgentConfig, deps: AgentDependencies) {
    this.id = config.id
    this.name = config.name
    this.role = config.role
    this.config = config
    this.provider = deps.provider
    this.tools = deps.tools
    this.memory = deps.memory
    this.eventBus = deps.eventBus
    this.logger = deps.logger.child({ source: config.id })
  }

  abstract onMessage(message: AgentMessage): Promise<AgentMessage>
  abstract onError(error: Error, message: AgentMessage): Promise<void>

  async onStart(): Promise<void> {}
  async onStop(): Promise<void> {}

  reply(original: AgentMessage, payload: Partial<AgentMessage['payload']>): AgentMessage {
    return {
      id: randomUUID(),
      from: this.id,
      to: original.from,
      type: 'response',
      priority: original.priority,
      payload: { ...original.payload, ...payload },
      metadata: {
        timestamp: new Date().toISOString(),
        ttl: 30000,
        traceId: original.metadata.traceId,
        parentId: original.id,
        correlationId: original.metadata.correlationId,
      },
    }
  }

  broadcast(type: string, payload: unknown): void {
    this.eventBus.publish(
      `agent.${this.id}`,
      this.id,
      { type, payload },
    )
  }

  protected async callTool(name: string, args: unknown): Promise<unknown> {
    const tool = this.tools.get(name)
    if (!tool) {
      throw new AgentError(`Tool "${name}" not available for agent "${this.id}"`)
    }
    this.logger.debug('Calling tool', { tool: name, args })
    return tool.execute(args)
  }

  async handleMessage(message: AgentMessage): Promise<AgentMessage> {
    if (this.consecutiveCalls >= this.config.limits.maxConsecutiveCalls) {
      throw new AgentError(`Agent "${this.id}" exceeded max consecutive calls (${this.config.limits.maxConsecutiveCalls})`)
    }
    this.consecutiveCalls++
    this.taskCounter++

    const timeoutMs = this.config.limits.timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      if (controller.signal.aborted) {
        throw new TimeoutError(`Agent "${this.id}" timed out after ${timeoutMs}ms`)
      }

      const result = await this.onMessage(message)

      await this.memory.store({
        type: 'episodic',
        agentId: this.id,
        content: JSON.stringify({
          taskId: message.id,
          traceId: message.metadata.traceId,
          input: message.payload.task,
          output: result.payload,
        }),
        metadata: { correlationId: message.metadata.correlationId },
      })

      return result
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      await this.onError(err, message)

      await this.memory.store({
        type: 'episodic',
        agentId: this.id,
        content: JSON.stringify({
          taskId: message.id,
          traceId: message.metadata.traceId,
          error: err.message,
        }),
        metadata: { correlationId: message.metadata.correlationId },
      })

      return {
        id: randomUUID(),
        from: this.id,
        to: message.from,
        type: 'error',
        priority: message.priority,
        payload: { data: { error: err.message, code: err instanceof AgentError ? err.code : 'UNKNOWN' } },
        metadata: {
          timestamp: new Date().toISOString(),
          ttl: 30000,
          traceId: message.metadata.traceId,
          parentId: message.id,
          correlationId: message.metadata.correlationId,
        },
      }
    } finally {
      clearTimeout(timeout)
      this.consecutiveCalls = Math.max(0, this.consecutiveCalls - 1)
    }
  }

  async start(): Promise<void> {
    if (this.running) return
    this.running = true
    this.logger.info('Agent starting', { role: this.role })
    await this.onStart()
    this.eventBus.publish(`agent.${this.id}.started`, this.id, { agentId: this.id })
    this.logger.info('Agent started', { role: this.role })
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false
    this.logger.info('Agent stopping', { role: this.role })
    await this.onStop()
    this.eventBus.publish(`agent.${this.id}.stopped`, this.id, { agentId: this.id })
    this.logger.info('Agent stopped', { role: this.role })
  }

  protected async getRelevantMemories(task: string, limit = 5): Promise<MemoryEntry[]> {
    return this.memory.search('semantic', task, limit)
  }

  protected async storeProcedural(content: string, metadata: Record<string, unknown>): Promise<MemoryEntry> {
    return this.memory.store({
      type: 'procedural',
      agentId: this.id,
      content,
      metadata,
    })
  }
}
