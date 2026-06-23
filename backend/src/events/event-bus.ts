import { EventEmitter } from 'node:events'

export type EventTopic =
  | `agent.${string}`
  | `provider.${string}`
  | `mcp.${string}`
  | `memory.${string}`
  | `system.${string}`
  | `workflow.${string}`
  | `router.${string}`
  | `*`

export interface EventEnvelope<T = unknown> {
  topic: EventTopic
  timestamp: string
  source: string
  payload: T
  correlationId?: string
}

export type EventHandler<T = unknown> = (event: EventEnvelope<T>) => void | Promise<void>

export class EventBus {
  private emitter = new EventEmitter()
  private wildcardHandlers = new Map<string, EventHandler[]>()

  private readonly maxListeners: number

  constructor(maxListeners = 100) {
    this.maxListeners = maxListeners
    this.emitter.setMaxListeners(maxListeners)
  }

  publish<T>(topic: EventTopic, source: string, payload: T, correlationId?: string): void {
    const envelope: EventEnvelope<T> = {
      topic,
      timestamp: new Date().toISOString(),
      source,
      payload,
      correlationId,
    }

    this.emitter.emit(topic, envelope)

    for (const [pattern, handlers] of this.wildcardHandlers) {
      if (this.matchWildcard(topic, pattern)) {
        for (const handler of handlers) {
          handler(envelope)
        }
      }
    }
  }

  subscribe<T>(topic: EventTopic, handler: EventHandler<T>): () => void {
    if (topic === '*') {
      const handlers = this.wildcardHandlers.get('*') ?? []
      handlers.push(handler as EventHandler)
      this.wildcardHandlers.set('*', handlers)
      return () => {
        const list = this.wildcardHandlers.get('*')
        if (list) {
          const idx = list.indexOf(handler as EventHandler)
          if (idx >= 0) list.splice(idx, 1)
        }
      }
    }

    if (topic.includes('*')) {
      const handlers = this.wildcardHandlers.get(topic) ?? []
      handlers.push(handler as EventHandler)
      this.wildcardHandlers.set(topic, handlers)
      return () => {
        const list = this.wildcardHandlers.get(topic)
        if (list) {
          const idx = list.indexOf(handler as EventHandler)
          if (idx >= 0) list.splice(idx, 1)
        }
      }
    }

    this.emitter.on(topic, handler as (...args: unknown[]) => void)

    return () => {
      this.emitter.off(topic, handler as (...args: unknown[]) => void)
    }
  }

  subscribeOnce<T>(topic: EventTopic, handler: EventHandler<T>): void {
    const wrapped: EventHandler<T> = (event) => {
      unsub()
      return handler(event)
    }
    const unsub = this.subscribe(topic, wrapped)
  }

  clear(): void {
    this.emitter.removeAllListeners()
    this.wildcardHandlers.clear()
  }

  listenerCount(topic?: EventTopic): number {
    if (topic) {
      return this.emitter.listenerCount(topic) + (this.wildcardHandlers.get(topic)?.length ?? 0)
    }
    return this.emitter.eventNames().reduce((acc, name) => acc + this.emitter.listenerCount(name as string), 0)
  }

  private matchWildcard(topic: EventTopic, pattern: string): boolean {
    if (pattern === '*') return true
    const topicParts = topic.split('.')
    const patternParts = pattern.split('.')
    if (patternParts.length > topicParts.length) return false
    return patternParts.every((part, i) => part === '*' || part === topicParts[i])
  }
}

export const eventBus = new EventBus()
