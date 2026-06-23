import { describe, it, expect } from 'vitest'
import {
  handleHealth,
  handleChat,
  handleExecute,
  handleListAgents,
  handleGetAgent,
  handleListProviders,
  handleListModels,
  handleListMCP,
  handleMCPStart,
  handleMCPStop,
  handleListMemory,
  handleDeleteMemory,
  handleListWorkflows,
  handleGetTrace,
} from '../../backend/src/api/routes.js'
import type { ApiRequest, RouteContext, ApiResponse } from '../../backend/src/api/routes.js'

function mockContext(overrides: Partial<RouteContext> = {}): RouteContext {
  return {
    mcp: {
      listServers: () => [],
      listTools: () => [],
    } as never,
    memory: {
      search: async () => [],
      delete: async () => true,
    } as never,
    auth: {
      validateApiKey: () => ({ authenticated: true, userId: 'test', permissions: ['*'] }),
    },
    config: {
      agents: [
        { id: 'coordinator', name: 'Coordinator', role: 'coordinator', systemPrompt: 'prompt', provider: 'openai', model: 'gpt-4o', tools: ['delegate'], memoryScope: ['working', 'episodic'], allowedPeers: ['*'], limits: { maxTokensPerTask: 4000, maxConsecutiveCalls: 10, timeout: 30000 } },
        { id: 'coder', name: 'Coder', role: 'coder', systemPrompt: 'prompt', provider: 'openai', model: 'gpt-4o', tools: ['write-code'], memoryScope: ['working'], allowedPeers: ['coordinator'], limits: { maxTokensPerTask: 8000, maxConsecutiveCalls: 20, timeout: 60000 } },
      ],
      providers: [{ id: 'openai', name: 'OpenAI' }, { id: 'anthropic', name: 'Anthropic' }],
      models: [{ id: 'gpt-4o', provider: 'openai', context: 128000 }],
      workflows: [{ id: 'wf-1', name: 'Test Workflow' }],
    },
    traceStore: new Map([['trace-abc', { steps: ['a', 'b'] }]]),
    ...overrides,
  }
}

function makeReq(overrides: Partial<ApiRequest> = {}): ApiRequest {
  return {
    method: 'GET',
    path: '/',
    params: {},
    query: {},
    body: undefined,
    auth: undefined,
    ...overrides,
  }
}

function assertOk(resp: ApiResponse): void {
  expect(resp.statusCode).toBe(200)
}

function assertBadRequest(resp: ApiResponse): void {
  expect(resp.statusCode).toBe(400)
}

function assertNotFound(resp: ApiResponse): void {
  expect(resp.statusCode).toBe(404)
}

describe('API Routes', () => {
  describe('health endpoint', () => {
    it('returns 200 with status healthy', async () => {
      const resp = await handleHealth(makeReq(), mockContext())
      assertOk(resp)
      expect(resp.body).toMatchObject({ status: 'healthy' })
      expect(resp.body).toHaveProperty('version')
      expect(resp.body).toHaveProperty('timestamp')
    })
  })

  describe('chat endpoint', () => {
    it('returns 200 with echo reply', async () => {
      const resp = await handleChat(
        makeReq({ method: 'POST', body: { message: 'Hello world', agentId: 'coder' } }),
        mockContext(),
      )
      assertOk(resp)
      expect(resp.body).toMatchObject({ reply: 'Echo: Hello world', agentId: 'coder' })
    })

    it('returns 400 when body is missing', async () => {
      const resp = await handleChat(makeReq(), mockContext())
      assertBadRequest(resp)
    })

    it('returns 400 when message is missing', async () => {
      const resp = await handleChat(makeReq({ method: 'POST', body: { agentId: 'coder' } }), mockContext())
      assertBadRequest(resp)
    })

    it('returns 400 when message is not a string', async () => {
      const resp = await handleChat(makeReq({ method: 'POST', body: { message: 123 } }), mockContext())
      assertBadRequest(resp)
    })
  })

  describe('execute endpoint', () => {
    it('returns 200 with task queued', async () => {
      const resp = await handleExecute(
        makeReq({ method: 'POST', body: { task: 'build feature', agentId: 'coder' } }),
        mockContext(),
      )
      assertOk(resp)
      expect(resp.body).toMatchObject({ status: 'queued', agentId: 'coder' })
      expect(resp.body).toHaveProperty('taskId')
    })

    it('returns 400 when task is missing', async () => {
      const resp = await handleExecute(makeReq({ method: 'POST', body: {} }), mockContext())
      assertBadRequest(resp)
    })
  })

  describe('agent listing', () => {
    it('returns all agents', async () => {
      const resp = await handleListAgents(makeReq(), mockContext())
      assertOk(resp)
      expect(resp.body.agents).toHaveLength(2)
    })

    it('returns agent by id', async () => {
      const resp = await handleGetAgent(makeReq({ params: { id: 'coordinator' } }), mockContext())
      assertOk(resp)
      expect(resp.body.agent.id).toBe('coordinator')
    })

    it('returns 404 for unknown agent', async () => {
      const resp = await handleGetAgent(makeReq({ params: { id: 'ghost' } }), mockContext())
      assertNotFound(resp)
    })
  })

  describe('provider listing', () => {
    it('returns all providers', async () => {
      const resp = await handleListProviders(makeReq(), mockContext())
      assertOk(resp)
      expect(resp.body.providers).toHaveLength(2)
    })
  })

  describe('model listing', () => {
    it('returns all models', async () => {
      const resp = await handleListModels(makeReq(), mockContext())
      assertOk(resp)
      expect(resp.body.models).toHaveLength(1)
    })
  })

  describe('MCP management', () => {
    it('returns MCP servers and tools', async () => {
      const resp = await handleListMCP(makeReq(), mockContext())
      assertOk(resp)
      expect(resp.body).toHaveProperty('servers')
      expect(resp.body).toHaveProperty('tools')
    })

    it('handleMCPStart returns success message', async () => {
      const resp = await handleMCPStart(makeReq({ params: { id: 'filesystem' } }), mockContext())
      assertOk(resp)
    })

    it('handleMCPStop returns success message', async () => {
      const resp = await handleMCPStop(makeReq({ params: { id: 'filesystem' } }), mockContext())
      assertOk(resp)
    })
  })

  describe('memory endpoints', () => {
    it('handleListMemory returns empty entries by default', async () => {
      const resp = await handleListMemory(makeReq(), mockContext())
      assertOk(resp)
      expect(resp.body.entries).toEqual([])
    })

    it('handleListMemory with search query', async () => {
      const ctx = mockContext({
        memory: {
          search: async () => [{ id: 'mem-1', type: 'working', agentId: 'test', content: 'data', createdAt: new Date().toISOString(), metadata: {} }],
          delete: async () => true,
        } as never,
      })
      const resp = await handleListMemory(makeReq({ query: { q: 'test', type: 'working' } }), ctx)
      assertOk(resp)
      expect(resp.body.entries).toHaveLength(1)
    })

    it('handleDeleteMemory returns 200 on success', async () => {
      const ctx = mockContext({
        memory: {
          search: async () => [],
          delete: async () => true,
        } as never,
      })
      const resp = await handleDeleteMemory(makeReq({ params: { id: 'mem-1' }, query: { type: 'working' } }), ctx)
      assertOk(resp)
    })

    it('handleDeleteMemory returns 404 when not found', async () => {
      const ctx = mockContext({
        memory: {
          search: async () => [],
          delete: async () => false,
        } as never,
      })
      const resp = await handleDeleteMemory(makeReq({ params: { id: 'nonexistent' } }), ctx)
      assertNotFound(resp)
    })
  })

  describe('workflow listing', () => {
    it('returns all workflows', async () => {
      const resp = await handleListWorkflows(makeReq(), mockContext())
      assertOk(resp)
      expect(resp.body.workflows).toHaveLength(1)
    })
  })

  describe('trace endpoint', () => {
    it('returns trace by id', async () => {
      const resp = await handleGetTrace(makeReq({ params: { traceId: 'trace-abc' } }), mockContext())
      assertOk(resp)
      expect(resp.body.trace).toBeDefined()
    })

    it('returns 404 for unknown trace', async () => {
      const resp = await handleGetTrace(makeReq({ params: { traceId: 'unknown' } }), mockContext())
      assertNotFound(resp)
    })
  })
})
