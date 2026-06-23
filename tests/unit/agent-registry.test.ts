import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { AgentRegistry } from '../../backend/src/registry/agent-registry.js'
import { AgentError } from '../../backend/src/errors.js'
import { randomUUID } from 'node:crypto'

function makeConfig(id = `agent-${randomUUID().slice(0, 8)}`): Record<string, unknown> {
  return {
    id,
    name: `Agent ${id}`,
    role: 'worker',
    systemPrompt: 'You are a worker agent',
    provider: 'openai',
    model: 'gpt-4o',
    tools: ['search', 'compute'],
    memoryScope: ['working', 'episodic'],
    allowedPeers: ['coordinator'],
    limits: {
      maxTokensPerTask: 4000,
      maxConsecutiveCalls: 10,
      timeout: 30000,
    },
    health: {
      status: 'healthy',
      lastHeartbeat: new Date().toISOString(),
      errorCount: 0,
    },
  }
}

describe('AgentRegistry', () => {
  let registry: AgentRegistry

  beforeEach(() => {
    registry = new AgentRegistry(5000)
  })

  afterEach(() => {
    registry.clear()
  })

  describe('register agent', () => {
    it('registers a new agent successfully', () => {
      const cfg = makeConfig('alpha')
      registry.register(cfg as never)
      const agent = registry.getAgent('alpha')
      expect(agent).toBeDefined()
      expect(agent!.config.id).toBe('alpha')
      expect(agent!.status).toBe('online')
      expect(agent!.metrics.messagesProcessed).toBe(0)
    })

    it('throws AgentError when registering duplicate agent', () => {
      const cfg = makeConfig('dup')
      registry.register(cfg as never)
      expect(() => registry.register(cfg as never)).toThrow(AgentError)
    })

    it('registers multiple agents', () => {
      registry.register(makeConfig('a') as never)
      registry.register(makeConfig('b') as never)
      registry.register(makeConfig('c') as never)
      expect(registry.getAllAgents()).toHaveLength(3)
    })
  })

  describe('deregister agent', () => {
    it('deregisters an existing agent', () => {
      const cfg = makeConfig('to-remove')
      registry.register(cfg as never)
      const removed = registry.deregister('to-remove')
      expect(removed).toBe(true)
      expect(registry.getAgent('to-remove')).toBeUndefined()
    })

    it('returns false for unknown agent', () => {
      expect(registry.deregister('ghost')).toBe(false)
    })

    it('removes message handler on deregister', () => {
      const cfg = makeConfig('handler-test')
      registry.register(cfg as never)
      registry.registerMessageHandler('handler-test', async () => { })
      registry.deregister('handler-test')
      expect(registry.getMessageHandler('handler-test')).toBeUndefined()
    })
  })

  describe('find by capability', () => {
    it('finds agents by model capability', () => {
      const cfg = makeConfig('coder')
      registry.register(cfg as never)
      const results = registry.findAgentsByCapability('code' as never)
      expect(results.length).toBeGreaterThanOrEqual(1)
    })

    it('returns empty when no agents match', () => {
      const results = registry.findAgentsByCapability('vision' as never)
      expect(results).toEqual([])
    })
  })

  describe('find by role', () => {
    it('finds agents matching role substring', () => {
      registry.register({ ...makeConfig('planner'), role: 'planner' } as never)
      registry.register({ ...makeConfig('coder'), role: 'developer/coder' } as never)
      const planners = registry.findAgentsByRole('planner')
      expect(planners).toHaveLength(1)
      const coders = registry.findAgentsByRole('coder')
      expect(coders).toHaveLength(1)
    })
  })

  describe('find by tool', () => {
    it('finds agents that have a specific tool', () => {
      registry.register({ ...makeConfig('agent-a'), tools: ['search'] } as never)
      registry.register({ ...makeConfig('agent-b'), tools: ['compute'] } as never)
      const searchAgents = registry.findAgentByTool('search')
      expect(searchAgents).toHaveLength(1)
      const computeAgents = registry.findAgentByTool('compute')
      expect(computeAgents).toHaveLength(1)
    })
  })

  describe('heartbeat monitoring', () => {
    it('updateHeartbeat changes lastHeartbeat', () => {
      const cfg = makeConfig('heartbeat-agent')
      registry.register(cfg as never)
      const agent = registry.getAgent('heartbeat-agent')!
      agent.lastHeartbeat = '2020-01-01T00:00:00.000Z'
      registry.updateHeartbeat('heartbeat-agent')
      const after = registry.getAgent('heartbeat-agent')!.lastHeartbeat
      expect(after).not.toBe('2020-01-01T00:00:00.000Z')
      expect(new Date(after).getTime()).toBeGreaterThan(new Date('2020-01-01T00:00:00.000Z').getTime())
    })

    it('marks agent as online when heartbeat received while offline', () => {
      const cfg = makeConfig('offline-agent')
      registry.register(cfg as never)
      const agent = registry.getAgent('offline-agent')!
      agent.status = 'offline'
      registry.updateHeartbeat('offline-agent')
      expect(registry.getAgent('offline-agent')!.status).toBe('online')
    })

    it('checkStaleAgents marks agents as offline after timeout', async () => {
      const cfg = makeConfig('stale-agent')
      registry.register(cfg as never)
      const oldDate = new Date(Date.now() - 10000).toISOString()
      registry.getAgent('stale-agent')!.lastHeartbeat = oldDate
      const stale = await registry.checkStaleAgents()
      expect(stale).toContain('stale-agent')
      expect(registry.getAgent('stale-agent')!.status).toBe('offline')
    })
  })

  describe('status management', () => {
    it('markBusy sets status to busy', () => {
      registry.register(makeConfig('busy-agent') as never)
      registry.markBusy('busy-agent')
      expect(registry.getAgent('busy-agent')!.status).toBe('busy')
    })

    it('markAvailable sets status to online', () => {
      registry.register(makeConfig('avail-agent') as never)
      registry.markBusy('avail-agent')
      registry.markAvailable('avail-agent')
      expect(registry.getAgent('avail-agent')!.status).toBe('online')
    })

    it('markError increments error count', () => {
      registry.register(makeConfig('err-agent') as never)
      registry.markError('err-agent', 'something broke')
      const agent = registry.getAgent('err-agent')
      expect(agent!.status).toBe('error')
      expect(agent!.errorCount).toBe(1)
    })
  })

  describe('message handlers', () => {
    it('registers and retrieves a message handler', () => {
      registry.register(makeConfig('handler-agent') as never)
      const handler = async () => { }
      registry.registerMessageHandler('handler-agent', handler)
      expect(registry.getMessageHandler('handler-agent')).toBe(handler)
    })

    it('throws when registering handler for unknown agent', () => {
      expect(() => registry.registerMessageHandler('ghost', async () => { })).toThrow(AgentError)
    })
  })

  describe('metrics', () => {
    it('updateMetrics accumulates values', () => {
      registry.register(makeConfig('metrics-agent') as never)
      registry.updateMetrics('metrics-agent', { messagesProcessed: 5, tokensUsed: 1000, latencyMs: 50 })
      const agent = registry.getAgent('metrics-agent')!
      expect(agent.metrics.messagesProcessed).toBe(5)
      expect(agent.metrics.totalTokensUsed).toBe(1000)
    })
  })

  describe('health check', () => {
    it('returns unhealthy when no agents registered', async () => {
      const health = await registry.healthCheck()
      expect(health.status).toBe('unhealthy')
    })

    it('returns healthy with online agents', async () => {
      registry.register(makeConfig('healthy-agent') as never)
      const health = await registry.healthCheck()
      expect(health.status).toBe('healthy')
    })
  })
})
