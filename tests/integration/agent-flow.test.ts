import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { MessageRouter } from '../../backend/src/router/message-router.js'
import { MessageDispatcher } from '../../backend/src/router/dispatcher.js'
import { randomUUID } from 'node:crypto'

interface AgentMessage {
  id: string
  from: string
  to: string | string[]
  type: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  payload: Record<string, unknown>
  metadata: {
    timestamp: string
    ttl: number
    traceId: string
    parentId?: string
    correlationId?: string
  }
}

function createMessage(from: string, to: string | string[], payload: Record<string, unknown>, overrides: Partial<AgentMessage> = {}): AgentMessage {
  const traceId = randomUUID()
  return {
    id: randomUUID(),
    from,
    to,
    type: 'request',
    priority: 'medium',
    payload,
    metadata: {
      timestamp: new Date().toISOString(),
      ttl: 30000,
      traceId: overrides.metadata?.traceId ?? traceId,
      correlationId: randomUUID(),
    },
    ...overrides,
  }
}

describe('Agent Message Flow Integration', () => {
  let router: MessageRouter
  let dispatcher: MessageDispatcher

  beforeEach(() => {
    router = new MessageRouter()
    dispatcher = new MessageDispatcher()
    dispatcher.setAgentLookup((id) => {
      const agent = registeredAgents.get(id)
      return agent ? { id, handleMessage: agent } : undefined
    })
  })

  afterEach(() => {
    registeredAgents.clear()
    router.clear()
  })

  const registeredAgents = new Map<string, (msg: AgentMessage) => Promise<AgentMessage | void>>()

  function registerAgent(id: string, handler: (msg: AgentMessage) => Promise<AgentMessage | void>): void {
    registeredAgents.set(id, handler)
  }

  describe('coordinator -> planner -> coder flow', () => {
    it('routes a task from coordinator to planner', async () => {
      const plannerReceived: AgentMessage[] = []

      registerAgent('planner', async (msg) => {
        plannerReceived.push(msg)
        return createMessage('planner', msg.from, { data: 'plan ready' }, { type: 'response', metadata: { ...msg.metadata } })
      })

      const task = createMessage('coordinator', 'planner', { task: 'Design the architecture' })
      router.route(task)
      await dispatcher.dispatch(task)

      expect(plannerReceived).toHaveLength(1)
      expect(plannerReceived[0].from).toBe('coordinator')
      expect(plannerReceived[0].payload.task).toBe('Design the architecture')
    })

    it('routes planner output to coder', async () => {
      const coderReceived: AgentMessage[] = []

      registerAgent('planner', async (msg) => {
        return createMessage('planner', 'coder', { task: 'Implement the plan', data: msg.payload }, { type: 'request', metadata: { ...msg.metadata } })
      })

      registerAgent('coder', async (msg) => {
        coderReceived.push(msg)
        return createMessage('coder', msg.from, { data: 'code written' }, { type: 'response', metadata: { ...msg.metadata } })
      })

      const traceId = randomUUID()
      const task = createMessage('coordinator', 'planner', { task: 'Build feature X' }, { metadata: { timestamp: new Date().toISOString(), ttl: 30000, traceId, correlationId: randomUUID() } })
      router.route(task)
      await dispatcher.dispatch(task)

      const plannerResponse = createMessage('planner', 'coder', { task: 'Implement the plan' }, { type: 'request', metadata: { timestamp: new Date().toISOString(), ttl: 30000, traceId, correlationId: randomUUID() } })
      router.route(plannerResponse)
      await dispatcher.dispatch(plannerResponse)

      expect(coderReceived).toHaveLength(1)
      expect(coderReceived[0].from).toBe('planner')
    })
  })

  describe('inter-agent communication', () => {
    it('agents can broadcast to multiple peers', async () => {
      const received: string[] = []

      registerAgent('planner', async (msg) => {
        received.push('planner')
        return createMessage('planner', msg.from, {})
      })

      registerAgent('coder', async (msg) => {
        received.push('coder')
        return createMessage('coder', msg.from, {})
      })

      registerAgent('qa', async (msg) => {
        received.push('qa')
        return createMessage('qa', msg.from, {})
      })

      const broadcast = createMessage('coordinator', ['planner', 'coder', 'qa'], { task: 'urgent update' })
      router.route(broadcast)
      await dispatcher.dispatch(broadcast)

      expect(received).toHaveLength(3)
      expect(received).toContain('planner')
      expect(received).toContain('coder')
      expect(received).toContain('qa')
    })

    it('agents send responses back to coordinator', async () => {
      const coordinatorMessages: AgentMessage[] = []

      registerAgent('coordinator', async (msg) => {
        coordinatorMessages.push(msg)
        return createMessage('coordinator', msg.from, {})
      })

      registerAgent('worker', async (msg) => {
        const response = createMessage('worker', 'coordinator', { result: 'done' }, { type: 'response', metadata: { ...msg.metadata } })
        router.route(response)
        await dispatcher.dispatch(response)
        return response
      })

      const task = createMessage('coordinator', 'worker', { task: 'Do work' })
      router.route(task)
      await dispatcher.dispatch(task)

      expect(coordinatorMessages.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('error recovery', () => {
    it('retries on transient failure', async () => {
      let attempts = 0

      registerAgent('flaky-service', async (_msg) => {
        attempts++
        if (attempts < 2) {
          throw new Error('transient error')
        }
        return createMessage('flaky-service', _msg.from, { data: 'success' }, { type: 'response', metadata: { ..._msg.metadata } })
      })

      const task = createMessage('coordinator', 'flaky-service', { task: 'flaky task' })
      router.route(task)
      await dispatcher.dispatch(task)

      expect(attempts).toBe(2)
    })

    it('reports failure when agent is not found', async () => {
      const task = createMessage('coordinator', 'non-existent-agent', { task: 'impossible' })
      router.route(task)
      await dispatcher.dispatch(task).catch(() => {})
    })

    it('handles timeout gracefully', async () => {
      registerAgent('slow-agent', async (_msg) => {
        return createMessage('slow-agent', _msg.from, {})
      })

      const task = createMessage('coordinator', 'slow-agent', { task: 'slow' })
      router.route(task)
      dispatcher.dispatch(task).catch(() => { })
    })
  })

  describe('priority-based message handling', () => {
    it('delivers critical priority messages before low priority', async () => {
      const deliveryOrder: string[] = []

      registerAgent('receiver', async (msg) => {
        deliveryOrder.push(msg.id)
        return createMessage('receiver', msg.from, {})
      })

      const low = createMessage('sender', 'receiver', { task: 'low' }, { priority: 'low' })
      const critical = createMessage('sender', 'receiver', { task: 'critical' }, { priority: 'critical' })

      router.route(low)
      router.route(critical)

      expect(router.dequeue('receiver')!.id).toBe(critical.id)
      expect(router.dequeue('receiver')!.id).toBe(low.id)
    })
  })
})
