import type { MemoryEntry, MemoryType, AgentConfig } from '../types.js'
import type { MCPServerStatus, MTPToolDefinition } from '../mcp/client-manager.js'
import type { MCPClientManager } from '../mcp/client-manager.js'
import type { MemoryManager } from '../memory/manager.js'
import type { AuthResult } from '../security/auth.js'
import { logger } from '../logger.js'

export interface ApiRequest {
  method: string
  path: string
  params: Record<string, string>
  query: Record<string, string>
  body?: unknown
  auth?: AuthResult
}

export interface ApiResponse {
  statusCode: number
  headers?: Record<string, string>
  body: unknown
}

export interface RouteContext {
  mcp: MCPClientManager
  memory: MemoryManager
  auth: {
    validateApiKey(key: string): AuthResult
  }
  config: {
    agents: AgentConfig[]
    providers: Array<{ id: string; name: string }>
    models: Array<{ id: string; provider: string; context: number }>
    workflows: Array<{ id: string; name: string }>
  }
  traceStore: Map<string, unknown>
}

const log = logger.child({ source: 'API' })

function jsonResponse(statusCode: number, body: unknown): ApiResponse {
  return { statusCode, headers: { 'content-type': 'application/json' }, body }
}

function ok(body: unknown): ApiResponse {
  return jsonResponse(200, body)
}

function created(body: unknown): ApiResponse {
  return jsonResponse(201, body)
}

function badRequest(message: string): ApiResponse {
  return jsonResponse(400, { error: 'bad_request', message })
}

function notFound(message: string): ApiResponse {
  return jsonResponse(404, { error: 'not_found', message })
}

function unauthorized(message = 'Unauthorized'): ApiResponse {
  return jsonResponse(401, { error: 'unauthorized', message })
}

function serverError(error: unknown): ApiResponse {
  log.error('Internal server error', { error })
  return jsonResponse(500, { error: 'internal_server_error', message: 'An unexpected error occurred' })
}

export async function handleHealth(_req: ApiRequest, _ctx: RouteContext): Promise<ApiResponse> {
  return ok({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '0.1.0-alpha',
  })
}

export async function handleChat(req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  if (!req.body || typeof req.body !== 'object') {
    return badRequest('Request body must be a JSON object')
  }

  const { message, agentId } = req.body as Record<string, unknown>

  if (!message || typeof message !== 'string') {
    return badRequest('message is required and must be a string')
  }

  return ok({
    reply: `Echo: ${message}`,
    agentId: agentId ?? 'default',
    timestamp: new Date().toISOString(),
  })
}

export async function handleExecute(req: ApiRequest, _ctx: RouteContext): Promise<ApiResponse> {
  if (!req.body || typeof req.body !== 'object') {
    return badRequest('Request body must be a JSON object')
  }

  const { task, agentId } = req.body as Record<string, unknown>

  if (!task || typeof task !== 'string') {
    return badRequest('task is required and must be a string')
  }

  return ok({
    taskId: crypto.randomUUID(),
    agentId: agentId ?? 'default',
    status: 'queued',
    timestamp: new Date().toISOString(),
  })
}

export async function handleListAgents(_req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  return ok({ agents: ctx.config.agents })
}

export async function handleGetAgent(req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  const agent = ctx.config.agents.find((a) => a.id === req.params.id)

  if (!agent) {
    return notFound(`Agent ${req.params.id} not found`)
  }

  return ok({ agent })
}

export async function handleListProviders(_req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  return ok({ providers: ctx.config.providers })
}

export async function handleListModels(_req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  return ok({ models: ctx.config.models })
}

export async function handleListMCP(_req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  const servers = ctx.mcp.listServers()
  return ok({ servers, tools: ctx.mcp.listTools() })
}

export async function handleMCPStart(req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  return ok({ message: `MCP server ${req.params.id} start requested` })
}

export async function handleMCPStop(req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  return ok({ message: `MCP server ${req.params.id} stop requested` })
}

export async function handleListMemory(_req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  const type = _req.query.type as MemoryType | undefined
  const search = _req.query.q

  try {
    if (search) {
      const entries = await ctx.memory.search(search, type ?? 'working')
      return ok({ entries })
    }

    return ok({ entries: [] })
  } catch (error) {
    return serverError(error)
  }
}

export async function handleDeleteMemory(req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  const type = (req.query.type as MemoryType) ?? 'working'

  try {
    const deleted = await ctx.memory.delete(req.params.id, type)

    if (!deleted) {
      return notFound(`Memory entry ${req.params.id} not found`)
    }

    return ok({ deleted: true })
  } catch (error) {
    return serverError(error)
  }
}

export async function handleListWorkflows(_req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  return ok({ workflows: ctx.config.workflows })
}

export async function handleGetTrace(req: ApiRequest, ctx: RouteContext): Promise<ApiResponse> {
  const trace = ctx.traceStore.get(req.params.traceId)

  if (!trace) {
    return notFound(`Trace ${req.params.traceId} not found`)
  }

  return ok({ trace })
}

export type RouteHandler = (req: ApiRequest, ctx: RouteContext) => Promise<ApiResponse>

export interface Route {
  method: string
  pattern: string
  handler: RouteHandler
}

export const routes: Route[] = [
  { method: 'GET', pattern: '/api/v1/health', handler: handleHealth },
  { method: 'POST', pattern: '/api/v1/chat', handler: handleChat },
  { method: 'POST', pattern: '/api/v1/execute', handler: handleExecute },
  { method: 'GET', pattern: '/api/v1/agents', handler: handleListAgents },
  { method: 'GET', pattern: '/api/v1/agents/:id', handler: handleGetAgent },
  { method: 'GET', pattern: '/api/v1/providers', handler: handleListProviders },
  { method: 'GET', pattern: '/api/v1/models', handler: handleListModels },
  { method: 'GET', pattern: '/api/v1/mcp', handler: handleListMCP },
  { method: 'POST', pattern: '/api/v1/mcp/:id/start', handler: handleMCPStart },
  { method: 'POST', pattern: '/api/v1/mcp/:id/stop', handler: handleMCPStop },
  { method: 'GET', pattern: '/api/v1/memory', handler: handleListMemory },
  { method: 'DELETE', pattern: '/api/v1/memory/:id', handler: handleDeleteMemory },
  { method: 'GET', pattern: '/api/v1/workflows', handler: handleListWorkflows },
  { method: 'GET', pattern: '/api/v1/trace/:traceId', handler: handleGetTrace },
]
