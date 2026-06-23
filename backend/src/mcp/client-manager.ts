import type { Transport, StdioTransportConfig, SSETransportConfig } from './transport.js'
import { StdioTransport, SSETransport } from './transport.js'
import { MCPError } from '../errors.js'
import { logger } from '../logger.js'

export interface MCPServerConfig {
  id: string
  name: string
  transport: 'stdio' | 'sse'
  autoStart?: boolean
  maxRetries?: number
  retryDelayMs?: number
  config: StdioTransportConfig | SSETransportConfig
}

export interface MCPServerStatus {
  id: string
  name: string
  connected: boolean
  tools: string[]
  uptime: number | null
}

export interface MCPToolDefinition {
  serverId: string
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface JSONRPCMessage {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: unknown
}

export interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

export class MCPClientManager {
  private servers: Map<string, { config: MCPServerConfig; transport: Transport; tools: MTPToolDefinition[]; connectedAt: number | null }> = new Map()
  private pendingRequests: Map<string | number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void; timer: ReturnType<typeof setTimeout> }> = new Map()
  private requestCounter: number = 0
  private log = logger.child({ source: 'MCPClientManager' })
  private requestTimeoutMs: number = 30000

  async startServer(config: MCPServerConfig): Promise<void> {
    if (this.servers.has(config.id)) {
      throw new MCPError(`Server ${config.id} is already registered`)
    }

    this.log.info(`Starting MCP server: ${config.id} (${config.name})`)

    let transport: Transport

    if (config.transport === 'stdio') {
      transport = new StdioTransport(config.config as StdioTransportConfig)
    } else if (config.transport === 'sse') {
      transport = new SSETransport(config.config as SSETransportConfig)
    } else {
      throw new MCPError(`Unsupported transport type: ${config.transport}`)
    }

    transport.onMessage((message) => {
      this.handleMessage(config.id, message)
    })

    transport.on('error', (error) => {
      this.log.error(`Transport error for server ${config.id}`, { error })
    })

    transport.on('disconnected', () => {
      this.log.warn(`Server ${config.id} disconnected`)
      const server = this.servers.get(config.id)
      if (server) {
        server.connectedAt = null
      }
    })

    await transport.connect()

    const tools: MTPToolDefinition[] = []

    try {
      const result = await this.sendRequest(config.id, {
        jsonrpc: '2.0',
        id: this.nextId(),
        method: 'tools/list',
      })
      if (result && typeof result === 'object' && 'tools' in result) {
        const toolList = (result as { tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> }).tools
        for (const t of toolList) {
          tools.push({ serverId: config.id, ...t })
        }
      }
    } catch (error) {
      this.log.warn(`Failed to list tools from server ${config.id}`, { error })
    }

    this.servers.set(config.id, {
      config,
      transport,
      tools,
      connectedAt: Date.now(),
    })

    this.log.info(`MCP server ${config.id} started with ${tools.length} tools`)
  }

  async stopServer(id: string): Promise<void> {
    const server = this.servers.get(id)
    if (!server) {
      throw new MCPError(`Server ${id} not found`)
    }

    this.log.info(`Stopping MCP server: ${id}`)
    await server.transport.disconnect()
    this.servers.delete(id)
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new MCPError(`Server ${serverId} not found`)
    }

    if (!server.transport.isConnected()) {
      throw new MCPError(`Server ${serverId} is not connected`)
    }

    this.log.debug(`Calling tool ${toolName} on server ${serverId}`, { args })

    return this.sendRequest(serverId, {
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/call',
      params: { name: toolName, arguments: args },
    })
  }

  listServers(): MCPServerStatus[] {
    const statuses: MCPServerStatus[] = []

    for (const [id, server] of this.servers) {
      statuses.push({
        id,
        name: server.config.name,
        connected: server.transport.isConnected(),
        tools: server.tools.map((t) => t.name),
        uptime: server.connectedAt ? Date.now() - server.connectedAt : null,
      })
    }

    return statuses
  }

  listTools(): MTPToolDefinition[] {
    const allTools: MTPToolDefinition[] = []
    for (const server of this.servers.values()) {
      allTools.push(...server.tools)
    }
    return allTools
  }

  getServer(id: string): MCPServerStatus | undefined {
    const server = this.servers.get(id)
    if (!server) return undefined

    return {
      id,
      name: server.config.name,
      connected: server.transport.isConnected(),
      tools: server.tools.map((t) => t.name),
      uptime: server.connectedAt ? Date.now() - server.connectedAt : null,
    }
  }

  private async sendRequest(serverId: string, request: JSONRPCMessage): Promise<unknown> {
    const server = this.servers.get(serverId)
    if (!server) {
      throw new MCPError(`Server ${serverId} not found`)
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id)
        reject(new MCPError(`Request ${request.id} timed out after ${this.requestTimeoutMs}ms`))
      }, this.requestTimeoutMs)

      this.pendingRequests.set(request.id, { resolve, reject, timer })

      server.transport.send(request).catch((error) => {
        clearTimeout(timer)
        this.pendingRequests.delete(request.id)
        reject(error)
      })
    })
  }

  private handleMessage(serverId: string, message: unknown): void {
    const response = message as JSONRPCResponse

    if (response.id !== undefined && this.pendingRequests.has(response.id)) {
      const pending = this.pendingRequests.get(response.id)!
      clearTimeout(pending.timer)
      this.pendingRequests.delete(response.id)

      if (response.error) {
        pending.reject(new MCPError(`MCP error: ${response.error.message}`, response.error))
      } else {
        pending.resolve(response.result)
      }
    } else if (message && typeof message === 'object' && 'method' in (message as Record<string, unknown>)) {
      const req = message as JSONRPCMessage
      this.log.debug(`Received request from server ${serverId}: ${req.method}`)
    }
  }

  private nextId(): number {
    return ++this.requestCounter
  }

  async startAll(configs: MCPServerConfig[]): Promise<void> {
    const results = await Promise.allSettled(
      configs.filter((c) => c.autoStart !== false).map((c) => this.startServer(c)),
    )

    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.status === 'rejected') {
        this.log.error(`Failed to start server ${configs[i]?.id}`, { error: result.reason })
      }
    }
  }

  async stopAll(): Promise<void> {
    const ids = Array.from(this.servers.keys())
    await Promise.all(ids.map((id) => this.stopServer(id).catch(() => {})))
  }
}
