import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { logger } from '../logger.js'
import { eventBus } from '../events/event-bus.js'
import { TimeoutError } from '../errors.js'
import type { AgentMessage, ComponentHealth } from '../types.js'

export interface AgentEndpoint {
  id: string
  handleMessage(message: AgentMessage): Promise<AgentMessage | void>
}

type AgentLookupFn = (agentId: string) => AgentEndpoint | undefined

export class MessageDispatcher {
  private agents = new Map<string, AgentEndpoint>()
  private agentLookup: AgentLookupFn | null = null
  private emitter = new EventEmitter()
  private activeDeliveries = 0
  private deliveryCount = 0
  private failureCount = 0
  private retryCount = 0

  private readonly maxRetries: number
  private readonly baseRetryDelayMs: number

  constructor(maxRetries = 3, baseRetryDelayMs = 1000) {
    this.maxRetries = maxRetries
    this.baseRetryDelayMs = baseRetryDelayMs
  }

  setAgentLookup(fn: AgentLookupFn): void {
    this.agentLookup = fn
  }

  registerAgent(agent: AgentEndpoint): void {
    this.agents.set(agent.id, agent)
    logger.info(`Agent registered with dispatcher: ${agent.id}`, { source: 'MessageDispatcher' })
  }

  deregisterAgent(agentId: string): void {
    this.agents.delete(agentId)
  }

  async dispatch(message: AgentMessage): Promise<void> {
    this.activeDeliveries++
    this.deliveryCount++

    const targets = typeof message.to === 'string' ? [message.to] : message.to

    try {
      const results = await Promise.allSettled(
        targets.map((targetId) => this.deliverToTarget(targetId, message)),
      )

      for (const result of results) {
        if (result.status === 'rejected') {
          this.failureCount++
          logger.error(`Delivery failed for message ${message.id}`, {
            source: 'MessageDispatcher',
            error: result.reason,
          })
          eventBus.publish('router.delivery_failed', 'dispatcher', {
            messageId: message.id,
            error: result.reason instanceof Error ? result.reason.message : String(result.reason),
          })
        }
      }
    } finally {
      this.activeDeliveries--
    }
  }

  private async deliverToTarget(targetId: string, message: AgentMessage, attempt = 1): Promise<void> {
    const agent = this.agents.get(targetId) ?? this.agentLookup?.(targetId)

    if (!agent) {
      logger.warn(`No agent found for target: ${targetId}`, { source: 'MessageDispatcher' })
      eventBus.publish('router.agent_not_found', 'dispatcher', {
        messageId: message.id,
        targetId,
      })
      throw new Error(`Agent not found: ${targetId}`)
    }

    const traceId = message.metadata.traceId

    try {
      const timeoutMs = this.calculateTimeout(message)
      const result = await this.deliverWithTimeout(agent, message, timeoutMs)

      eventBus.publish('router.delivered', 'dispatcher', {
        messageId: message.id,
        targetId,
        traceId,
      })

      if (result) {
        this.emitter.emit('response', result)
      }
    } catch (error) {
      if (attempt < this.maxRetries) {
        this.retryCount++
        const delay = this.baseRetryDelayMs * Math.pow(2, attempt - 1)
        logger.info(`Retrying delivery to ${targetId} (attempt ${attempt + 1}/${this.maxRetries})`, {
          source: 'MessageDispatcher',
          messageId: message.id,
        })

        await this.sleep(delay)
        return this.deliverToTarget(targetId, message, attempt + 1)
      }

      throw error
    }
  }

  private async deliverWithTimeout(
    agent: AgentEndpoint,
    message: AgentMessage,
    timeoutMs: number,
  ): Promise<AgentMessage | void> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Delivery to ${agent.id} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    return Promise.race([agent.handleMessage(message), timeoutPromise])
  }

  private calculateTimeout(message: AgentMessage): number {
    if (message.priority === 'critical') return 60_000
    if (message.priority === 'high') return 30_000
    if (message.priority === 'medium') return 15_000
    return 10_000
  }

  onResponse(handler: (message: AgentMessage) => void): () => void {
    this.emitter.on('response', handler)
    return () => { this.emitter.off('response', handler) }
  }

  getStats(): { deliveryCount: number; failureCount: number; retryCount: number; activeDeliveries: number } {
    return {
      deliveryCount: this.deliveryCount,
      failureCount: this.failureCount,
      retryCount: this.retryCount,
      activeDeliveries: this.activeDeliveries,
    }
  }

  async healthCheck(): Promise<ComponentHealth> {
    const failureRate = this.deliveryCount > 0 ? this.failureCount / this.deliveryCount : 0
    let status: ComponentHealth['status'] = 'healthy'

    if (failureRate > 0.5) status = 'unhealthy'
    else if (failureRate > 0.2) status = 'degraded'

    return {
      componentId: 'dispatcher',
      status,
      lastCheck: new Date().toISOString(),
      details: `${this.deliveryCount} deliveries, ${this.failureCount} failures, ${this.activeDeliveries} active`,
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
