import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { logger } from '../logger.js'
import { MCPError } from '../errors.js'

export interface Transport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(message: unknown): Promise<void>
  onMessage(callback: (message: unknown) => void): void
  isConnected(): boolean
}

export interface StdioTransportConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
  cwd?: string
}

export class StdioTransport extends EventEmitter implements Transport {
  private config: StdioTransportConfig
  private process: ChildProcess | null = null
  private buffer: string = ''
  private connected: boolean = false
  private messageCallback: ((message: unknown) => void) | null = null
  private log = logger.child({ source: 'StdioTransport' })

  constructor(config: StdioTransportConfig) {
    super()
    this.config = config
  }

  async connect(): Promise<void> {
    if (this.connected) {
      this.log.warn('Transport already connected')
      return
    }

    this.log.info(`Spawning MCP server: ${this.config.command}`)

    this.process = spawn(this.config.command, this.config.args ?? [], {
      env: { ...process.env, ...this.config.env },
      cwd: this.config.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
    })

    this.process.stdout?.on('data', this.handleData.bind(this))
    this.process.stderr?.on('data', (data: Buffer) => {
      this.log.warn(`MCP server stderr: ${data.toString().trim()}`)
    })

    this.process.on('error', (error) => {
      this.log.error('MCP server process error', { error })
      this.emit('error', error)
    })

    this.process.on('close', (code) => {
      this.log.info(`MCP server process closed with code ${code}`)
      this.connected = false
      this.process = null
      this.emit('disconnected', code)
    })

    this.connected = true
    this.emit('connected')
  }

  async disconnect(): Promise<void> {
    if (!this.connected || !this.process) {
      return
    }

    this.log.info('Disconnecting MCP transport')

    this.process.stdin?.end()
    this.process.kill()

    this.connected = false
    this.process = null
    this.buffer = ''
    this.emit('disconnected')
  }

  async send(message: unknown): Promise<void> {
    if (!this.connected || !this.process?.stdin?.writable) {
      throw new MCPError('Transport is not connected')
    }

    const raw = JSON.stringify(message) + '\n'
    this.log.debug('Sending MCP message', { message })

    return new Promise((resolve, reject) => {
      this.process!.stdin!.write(raw, (error) => {
        if (error) {
          reject(new MCPError('Failed to send message', error))
        } else {
          resolve()
        }
      })
    })
  }

  onMessage(callback: (message: unknown) => void): void {
    this.messageCallback = callback
  }

  isConnected(): boolean {
    return this.connected
  }

  private handleData(data: Buffer): void {
    this.buffer += data.toString()

    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      try {
        const parsed = JSON.parse(trimmed)
        this.log.debug('Received MCP message', { message: parsed })
        this.messageCallback?.(parsed)
        this.emit('message', parsed)
      } catch (error) {
        this.log.error('Failed to parse MCP message', { line: trimmed, error })
      }
    }
  }
}

export interface SSETransportConfig {
  url: string
  headers?: Record<string, string>
}

export class SSETransport extends EventEmitter implements Transport {
  private config: SSETransportConfig
  private connected: boolean = false
  private messageCallback: ((message: unknown) => void) | null = null
  private abortController: AbortController | null = null
  private log = logger.child({ source: 'SSETransport' })

  constructor(config: SSETransportConfig) {
    super()
    this.config = config
  }

  async connect(): Promise<void> {
    this.log.info(`Connecting to SSE endpoint: ${this.config.url}`)

    this.abortController = new AbortController()

    try {
      const response = await fetch(this.config.url, {
        headers: { Accept: 'text/event-stream', ...this.config.headers },
        signal: this.abortController.signal,
      })

      if (!response.ok) {
        throw new MCPError(`SSE connection failed: ${response.status} ${response.statusText}`)
      }

      this.connected = true
      this.emit('connected')

      const reader = response.body?.getReader()
      if (!reader) {
        throw new MCPError('SSE response body is not readable')
      }

      this.readStream(reader)
    } catch (error) {
      if (error instanceof MCPError) throw error
      throw new MCPError('SSE connection error', error)
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
    } catch (error) {
      this.log.error('SSE stream error', { error })
    } finally {
      reader.releaseLock()
      this.connected = false
      this.emit('disconnected')
    }
  }

  private processSSEEvent(event: string): void {
    const lines = event.split('\n')
    let data = ''

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        data += line.slice(6)
      }
    }

    if (!data) return

    try {
      const parsed = JSON.parse(data)
      this.messageCallback?.(parsed)
      this.emit('message', parsed)
    } catch (error) {
      this.log.error('Failed to parse SSE event data', { data, error })
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false
    this.abortController?.abort()
    this.abortController = null
    this.emit('disconnected')
  }

  async send(message: unknown): Promise<void> {
    throw new MCPError('SSE transport does not support sending messages')
  }

  onMessage(callback: (message: unknown) => void): void {
    this.messageCallback = callback
  }

  isConnected(): boolean {
    return this.connected
  }
}
