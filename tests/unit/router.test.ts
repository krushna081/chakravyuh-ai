import { describe, it, expect, beforeEach } from 'vitest'
import { MessageRouter } from '../../backend/src/router/message-router.js'
import { ValidationError } from '../../backend/src/errors.js'
import { randomUUID } from 'node:crypto'

function makeMsg(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: randomUUID(),
    from: 'sender',
    to: 'receiver',
    type: 'request',
    priority: 'medium',
    payload: { task: 'test' },
    metadata: {
      timestamp: new Date().toISOString(),
      ttl: 30000,
      traceId: randomUUID(),
      correlationId: randomUUID(),
    },
    ...overrides,
  }
}

describe('MessageRouter', () => {
  let router: MessageRouter

  beforeEach(() => {
    router = new MessageRouter()
  })

  describe('message validity checks', () => {
    it('throws ValidationError when "from" is missing', () => {
      const msg = makeMsg({ from: undefined })
      expect(() => router.route(msg as never)).toThrow(ValidationError)
    })

    it('throws ValidationError when "to" is missing', () => {
      const msg = makeMsg({ to: undefined })
      expect(() => router.route(msg as never)).toThrow(ValidationError)
    })

    it('auto-generates id if missing', () => {
      const msg = makeMsg({ id: undefined })
      router.route(msg as never)
      expect(msg.id).toBeDefined()
    })

    it('auto-fills timestamp if missing', () => {
      const msg = makeMsg({ metadata: { ttl: 1000, traceId: randomUUID(), correlationId: randomUUID() } })
      router.route(msg as never)
      expect(msg.metadata.timestamp).toBeDefined()
    })

    it('auto-fills traceId if missing', () => {
      const msg = makeMsg({ metadata: { timestamp: new Date().toISOString(), ttl: 1000, correlationId: randomUUID() } })
      router.route(msg as never)
      expect(msg.metadata.traceId).toBeDefined()
    })
  })

  describe('direct message routing', () => {
    it('routes a message to a single target', () => {
      const msg = makeMsg({ to: 'agent-alpha' })
      router.route(msg as never)
      expect(router.queueLength('agent-alpha')).toBe(1)
    })

    it('dequeues the routed message', () => {
      const msg = makeMsg({ to: 'agent-beta' })
      router.route(msg as never)
      const dequeued = router.dequeue('agent-beta')
      expect(dequeued).toBeDefined()
      expect(dequeued!.id).toBe(msg.id)
    })

    it('returns null when dequeueing empty queue', () => {
      expect(router.dequeue('nobody')).toBeNull()
    })

    it('peek returns first message without removing', () => {
      const msg = makeMsg({ to: 'agent-gamma' })
      router.route(msg as never)
      const peeked = router.peek('agent-gamma')
      expect(peeked).toBeDefined()
      expect(peeked!.id).toBe(msg.id)
      expect(router.queueLength('agent-gamma')).toBe(1)
    })

    it('peek returns null on empty queue', () => {
      expect(router.peek('empty')).toBeNull()
    })
  })

  describe('broadcast routing', () => {
    it('routes to all agents when target is "*"', () => {
      const msg = makeMsg({ to: '*' })
      router.route(msg as never)
      expect(router.queueLength('*')).toBe(1)
    })

    it('routes to multiple targets when "to" is an array', () => {
      const msg = makeMsg({ to: ['alpha', 'beta', 'gamma'] })
      router.route(msg as never)
      expect(router.queueLength('alpha')).toBe(1)
      expect(router.queueLength('beta')).toBe(1)
      expect(router.queueLength('gamma')).toBe(1)
    })
  })

  describe('priority queue bypass', () => {
    it('sorts messages by priority (critical first)', () => {
      const low = makeMsg({ to: 'agent', priority: 'low', id: 'low-1' })
      const high = makeMsg({ to: 'agent', priority: 'high', id: 'high-1' })
      const critical = makeMsg({ to: 'agent', priority: 'critical', id: 'crit-1' })
      router.route(low as never)
      router.route(high as never)
      router.route(critical as never)
      const first = router.dequeue('agent')
      expect(first!.id).toBe('crit-1')
    })

    it('preserves order within same priority level', () => {
      const first = makeMsg({ to: 'agent', priority: 'medium', id: 'first' })
      const second = makeMsg({ to: 'agent', priority: 'medium', id: 'second' })
      router.route(first as never)
      router.route(second as never)
      expect(router.dequeue('agent')!.id).toBe('first')
      expect(router.dequeue('agent')!.id).toBe('second')
    })
  })

  describe('queue management', () => {
    it('hasMessages returns false for empty queue', () => {
      expect(router.hasMessages('nosuch')).toBe(false)
    })

    it('hasMessages returns true when messages exist', () => {
      router.route(makeMsg({ to: 'busy' }) as never)
      expect(router.hasMessages('busy')).toBe(true)
    })

    it('totalQueued returns sum across all targets', () => {
      router.route(makeMsg({ to: 'a' }) as never)
      router.route(makeMsg({ to: 'b' }) as never)
      router.route(makeMsg({ to: 'c' }) as never)
      expect(router.totalQueued()).toBe(3)
    })

    it('clear empties all queues', () => {
      router.route(makeMsg({ to: 'a' }) as never)
      router.route(makeMsg({ to: 'b' }) as never)
      router.clear()
      expect(router.totalQueued()).toBe(0)
    })
  })

  describe('event subscription', () => {
    it('onMessage emits when message arrives for target', () => {
      return new Promise<void>((done) => {
        router.onMessage('watcher', (msg) => {
          expect(msg.to).toBe('watcher')
          done()
        })
        router.route(makeMsg({ to: 'watcher' }) as never)
      })
    })
  })

  describe('stats and health', () => {
    it('getStats returns counters and queue sizes', () => {
      router.route(makeMsg({ to: 'x' }) as never)
      router.markFailed()
      const stats = router.getStats()
      expect(stats.messageCount).toBe(1)
      expect(stats.failedCount).toBe(1)
      expect(stats.queueSizes.x).toBe(1)
    })

    it('healthCheck returns healthy for small queues', async () => {
      const health = await router.healthCheck()
      expect(health.status).toBe('healthy')
      expect(health.componentId).toBe('router')
    })
  })
})
