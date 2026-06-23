import { spawn, type ChildProcess } from 'node:child_process'
import { createReadStream, createWriteStream } from 'node:fs'
import { readFile } from 'node:fs/promises'

export interface JSONRPCRequest {
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

export interface JSONRPCNotification {
  jsonrpc: '2.0'
  method: string
  params?: unknown
}

export type JSONRPCMessage = JSONRPCRequest | JSONRPCResponse | JSONRPCNotification

export interface Transport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(message: JSONRPCMessage): Promise<void>
  onMessage(callback: (message: JSONRPCMessage) => void): void
  isConnected(): boolean
}

export class StdioClientTransport implements Transport {
  private process: ChildProcess | null = null
  private buffer = ''
  private connected = false
  private messageCallback: ((message: JSONRPCMessage) => void) | null = null

  constructor(
    private command: string,
    private args: string[] = [],
    private env: Record<string, string> = {},
    private cwd?: string,
  ) {}

  async connect(): Promise<void> {
    this.process = spawn(this.command, this.args, {
      env: { ...process.env, ...this.env },
      cwd: this.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })

    this.process.stdout?.on('data', (data: Buffer) => {
      this.buffer += data.toString()
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          this.messageCallback?.(JSON.parse(trimmed) as JSONRPCMessage)
        } catch {
          process.stderr.write(`Failed to parse MCP message: ${trimmed}\n`)
        }
      }
    })

    this.process.stderr?.on('data', (data: Buffer) => {
      process.stderr.write(`[MCP Server:${this.command}] ${data.toString()}`)
    })

    this.process.on('error', (err) => {
      process.stderr.write(`MCP server process error: ${err.message}\n`)
    })

    this.process.on('close', (code) => {
      this.connected = false
      this.process = null
    })

    this.connected = true
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.process) return
    this.process.stdin?.end()
    this.process.kill()
    this.connected = false
    this.process = null
    this.buffer = ''
  }

  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.connected || !this.process?.stdin?.writable) {
      throw new Error('Transport is not connected')
    }
    const raw = JSON.stringify(message) + '\n'
    return new Promise((resolve, reject) => {
      this.process!.stdin!.write(raw, (error) => {
        if (error) reject(new Error(`Failed to send message: ${error.message}`))
        else resolve()
      })
    })
  }

  onMessage(callback: (message: JSONRPCMessage) => void): void {
    this.messageCallback = callback
  }

  isConnected(): boolean {
    return this.connected
  }
}

export class SSEClientTransport implements Transport {
  private abortController: AbortController | null = null
  private connected = false
  private messageCallback: ((message: JSONRPCMessage) => void) | null = null
  private source: EventSource | null = null

  constructor(
    private url: string,
    private headers: Record<string, string> = {},
  ) {}

  async connect(): Promise<void> {
    this.abortController = new AbortController()
    try {
      const response = await fetch(this.url, {
        headers: { Accept: 'text/event-stream', ...this.headers },
        signal: this.abortController.signal,
      })
      if (!response.ok) {
        throw new Error(`SSE connection failed: ${response.status} ${response.statusText}`)
      }
      this.connected = true
      const reader = response.body?.getReader()
      if (!reader) throw new Error('SSE response body not readable')
      this.readStream(reader)
    } catch (error) {
      throw new Error(`SSE connection error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  private async readStream(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<void> {
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (this.connected) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''
        for (const event of events) {
          this.processSSEEvent(event)
        }
      }
    } finally {
      reader.releaseLock()
      this.connected = false
    }
  }

  private processSSEEvent(event: string): void {
    const lines = event.split('\n')
    let data = ''
    for (const line of lines) {
      if (line.startsWith('data: ')) data += line.slice(6)
    }
    if (!data) return
    try {
      this.messageCallback?.(JSON.parse(data) as JSONRPCMessage)
    } catch {
      // ignore parse errors
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.abortController?.abort()
    this.abortController = null
  }

  async send(_message: JSONRPCMessage): Promise<void> {
    throw new Error('SSE transport does not support sending messages')
  }

  onMessage(callback: (message: JSONRPCMessage) => void): void {
    this.messageCallback = callback
  }

  isConnected(): boolean {
    return this.connected
  }
}

export interface MCPClientOptions {
  requestTimeout?: number
  notificationHandler?: (notification: JSONRPCNotification) => void
}

export class MCPClient {
  private transport: Transport | null = null
  private pendingRequests = new Map<string | number, { resolve: (value: unknown) => void; reject: (reason: unknown) => void; timer: ReturnType<typeof setTimeout> }>()
  private requestId = 0
  private options: Required<MCPClientOptions>

  constructor(options?: MCPClientOptions) {
    this.options = {
      requestTimeout: options?.requestTimeout ?? 30000,
      notificationHandler: options?.notificationHandler ?? (() => {}),
    }
  }

  async connect(transport: Transport): Promise<void> {
    if (this.transport?.isConnected()) {
      throw new Error('Client is already connected')
    }
    this.transport = transport
    transport.onMessage((message) => this.handleMessage(message))
    await transport.connect()
  }

  async disconnect(): Promise<void> {
    for (const [, pending] of this.pendingRequests) {
      clearTimeout(pending.timer)
      pending.reject(new Error('Client disconnected'))
    }
    this.pendingRequests.clear()
    await this.transport?.disconnect()
    this.transport = null
  }

  async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    return this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/call',
      params: { name, arguments: args },
    })
  }

  async listTools(): Promise<Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }>> {
    const result = await this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'tools/list',
    })
    if (result && typeof result === 'object' && 'tools' in result) {
      return (result as { tools: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> }).tools
    }
    return []
  }

  async ping(): Promise<unknown> {
    return this.sendRequest({
      jsonrpc: '2.0',
      id: this.nextId(),
      method: 'ping',
    })
  }

  onNotification(handler: (notification: JSONRPCNotification) => void): void {
    this.options.notificationHandler = handler
  }

  private async sendRequest(request: JSONRPCRequest): Promise<unknown> {
    if (!this.transport?.isConnected()) {
      throw new Error('Client is not connected')
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(request.id)
        reject(new Error(`Request timed out after ${this.options.requestTimeout}ms`))
      }, this.options.requestTimeout)

      this.pendingRequests.set(request.id, { resolve, reject, timer })

      this.transport!.send(request).catch((error) => {
        clearTimeout(timer)
        this.pendingRequests.delete(request.id)
        reject(error)
      })
    })
  }

  private handleMessage(message: JSONRPCMessage): void {
    if ('id' in message && message.id !== undefined && 'method' in message) {
      return
    }

    if ('id' in message && message.id !== undefined) {
      const response = message as JSONRPCResponse
      const pending = this.pendingRequests.get(response.id)
      if (pending) {
        clearTimeout(pending.timer)
        this.pendingRequests.delete(response.id)
        if (response.error) {
          pending.reject(new Error(`MCP error: ${response.error.message}`))
        } else {
          pending.resolve(response.result)
        }
      }
    } else if (!('id' in message) && 'method' in message) {
      this.options.notificationHandler(message as JSONRPCNotification)
    }
  }

  private nextId(): number {
    return ++this.requestId
  }
}
