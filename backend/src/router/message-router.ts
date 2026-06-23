import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { logger } from '../logger.js'
import { eventBus } from '../events/event-bus.js'
import { ValidationError } from '../errors.js'
import type {
  AgentMessage,
  ComponentHealth,
} from '../types.js'

export type RoutingStrategy = 'direct' | 'multicast' | 'broadcast' | 'priority'

interface QueuedMessage {
  message: AgentMessage
  enqueuedAt: string
  priorityOrder: number
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
}

export class MessageRouter {
  private queues = new Map<string, QueuedMessage[]>()
  private emitter = new EventEmitter()
  private maxQueueSize: number
  private messageCount = 0
  private failedCount = 0

  constructor(maxQueueSize = 1000) {
    this.maxQueueSize = maxQueueSize
  }

  route(message: AgentMessage): void {
    this.validateMessage(message)

    const targets = this.resolveTargets(message)
    for (const target of targets) {
      this.enqueue(target, message)
    }

    this.messageCount++
    eventBus.publish('router.message', 'message-router', {
      messageId: message.id,
      from: message.from,
      to: message.to,
      type: message.type,
      priority: message.priority,
    })
  }

  private validateMessage(message: AgentMessage): void {
    if (!message.id) message.id = randomUUID()
    if (!message.from) throw new ValidationError('Message must have a "from" field')
    if (!message.to) throw new ValidationError('Message must have a "to" field')
    if (!message.metadata?.timestamp) {
      message.metadata.timestamp = new Date().toISOString()
    }
    if (!message.metadata?.traceId) {
      message.metadata.traceId = randomUUID()
    }
  }

  private resolveTargets(message: AgentMessage): string[] {
    const to = message.to
    if (typeof to === 'string') {
      if (to === '*') return ['*']
      return [to]
    }
    if (Array.isArray(to)) return to
    return []
  }

  private enqueue(target: string, message: AgentMessage): void {
    if (!this.queues.has(target)) {
      this.queues.set(target, [])
    }

    const queue = this.queues.get(target)!
    if (queue.length >= this.maxQueueSize) {
      logger.warn(`Queue full for target ${target}, dropping oldest message`, { source: 'MessageRouter' })
      queue.shift()
    }

    const priorityOrder = PRIORITY_ORDER[message.priority] ?? 99

    const queued: QueuedMessage = {
      message,
      enqueuedAt: new Date().toISOString(),
      priorityOrder,
    }

    queue.push(queued)
    queue.sort((a, b) => a.priorityOrder - b.priorityOrder)

    this.emitter.emit('message', target, message)
  }

  dequeue(target: string): AgentMessage | null {
    const queue = this.queues.get(target)
    if (!queue || queue.length === 0) return null

    const item = queue.shift()!
    return item.message
  }

  peek(target: string): AgentMessage | null {
    const queue = this.queues.get(target)
    if (!queue || queue.length === 0) return null
    return queue[0]!.message
  }

  queueLength(target: string): number {
    return this.queues.get(target)?.length ?? 0
  }

  totalQueued(): number {
    let total = 0
    for (const queue of this.queues.values()) {
      total += queue.length
    }
    return total
  }

  hasMessages(target: string): boolean {
    return this.queueLength(target) > 0
  }

  onMessage(target: string, handler: (message: AgentMessage) => void): () => void {
    this.emitter.on('message', (t: string, msg: AgentMessage) => {
      if (t === target) handler(msg)
    })
    return () => { this.emitter.off('message', handler) }
  }

  clear(): void {
    this.queues.clear()
    this.emitter.removeAllListeners()
  }

  getStats(): { messageCount: number; failedCount: number; queueSizes: Record<string, number> } {
    const queueSizes: Record<string, number> = {}
    for (const [target, queue] of this.queues) {
      queueSizes[target] = queue.length
    }
    return {
      messageCount: this.messageCount,
      failedCount: this.failedCount,
      queueSizes,
    }
  }

  markFailed(): void {
    this.failedCount++
  }

  async healthCheck(): Promise<ComponentHealth> {
    const total = this.totalQueued()
    return {
      componentId: 'router',
      status: total > this.maxQueueSize * 0.9 ? 'degraded' : 'healthy',
      lastCheck: new Date().toISOString(),
      details: `${total} messages queued, ${this.messageCount} total routed`,
      latencyMs: undefined,
    }
  }
}
