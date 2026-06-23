import http from 'node:http'
import { randomUUID } from 'node:crypto'
import type { ApiRequest, ApiResponse, RouteHandler, RouteContext } from './routes.js'
import { routes } from './routes.js'
import { logger } from '../logger.js'

export interface ServerConfig {
  host?: string
  port?: number
  corsOrigins?: string[]
  bodySizeLimit?: number
}

interface ParsedRoute {
  method: string
  patternParts: string[]
  handler: RouteHandler
}

export class ApiServer {
  private server: http.Server
  private config: Required<ServerConfig>
  private parsedRoutes: ParsedRoute[]
  private running = false
  private context: RouteContext
  private log = logger.child({ source: 'ApiServer' })

  constructor(context: RouteContext, config?: ServerConfig) {
    this.context = context
    this.config = {
      host: config?.host ?? '127.0.0.1',
      port: config?.port ?? 3001,
      corsOrigins: config?.corsOrigins ?? ['*'],
      bodySizeLimit: config?.bodySizeLimit ?? 1024 * 1024,
    }

    this.parsedRoutes = routes.map((r) => ({
      method: r.method,
      patternParts: r.pattern.split('/').filter(Boolean),
      handler: r.handler,
    }))

    this.server = http.createServer(this.handleRequest.bind(this))
    this.server.on('upgrade', this.handleUpgrade.bind(this))
  }

  start(port?: number): Promise<void> {
    const p = port ?? this.config.port

    return new Promise((resolve) => {
      this.server.listen(p, this.config.host, () => {
        this.running = true
        this.log.info(`API server listening on ${this.config.host}:${p}`)
        resolve()
      })
    })
  }

  stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.running) {
        resolve()
        return
      }

      this.server.close(() => {
        this.running = false
        this.log.info('API server stopped')
        resolve()
      })
    })
  }

  isRunning(): boolean {
    return this.running
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const startTime = Date.now()
    const requestId = randomUUID()

    const log = logger.child({ source: 'ApiServer', correlationId: requestId })

    try {
      const body = await this.readBody(req)

      const handlerResult = await this.dispatch(
        req.method ?? 'GET',
        req.url ?? '/',
        body,
      )

      const response = handlerResult ?? {
        statusCode: 404,
        headers: { 'content-type': 'application/json' },
        body: { error: 'not_found', message: `Route not found: ${req.method} ${req.url}` },
      }

      this.writeResponse(res, response)

      log.info(`${req.method} ${req.url} -> ${response.statusCode} (${Date.now() - startTime}ms)`)
    } catch (error) {
      log.error('Unhandled request error', { error })
      this.writeResponse(res, {
        statusCode: 500,
        headers: { 'content-type': 'application/json' },
        body: { error: 'internal_server_error', message: 'Internal server error' },
      })
    }
  }

  private readBody(req: http.IncomingMessage): Promise<string> {
    return new Promise((resolve, reject) => {
      if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') {
        resolve('')
        return
      }

      const chunks: Buffer[] = []
      let totalSize = 0

      req.on('data', (chunk: Buffer) => {
        totalSize += chunk.length
        if (totalSize > this.config.bodySizeLimit) {
          reject(new Error('Request body too large'))
          req.destroy()
          return
        }
        chunks.push(chunk)
      })

      req.on('end', () => {
        resolve(Buffer.concat(chunks).toString('utf-8'))
      })

      req.on('error', reject)
    })
  }

  private dispatch(method: string, url: string, rawBody: string): Promise<ApiResponse | null> {
    const [pathPart] = url.split('?')
    const queryString = url.includes('?') ? url.slice(url.indexOf('?') + 1) : ''
    const query = this.parseQuery(queryString)

    const urlParts = pathPart.split('/').filter(Boolean)

    const corsOrigin = this.config.corsOrigins.includes('*')
      ? '*'
      : this.config.corsOrigins.join(', ')

    for (const route of this.parsedRoutes) {
      if (route.method !== method) continue

      const params: Record<string, string> = {}
      let matched = true

      if (route.patternParts.length !== urlParts.length) {
        matched = false
      } else {
        for (let i = 0; i < route.patternParts.length; i++) {
          const patternPart = route.patternParts[i]!
          const urlPart = urlParts[i]!

          if (patternPart.startsWith(':')) {
            params[patternPart.slice(1)] = decodeURIComponent(urlPart)
          } else if (patternPart !== urlPart) {
            matched = false
            break
          }
        }
      }

      if (!matched) continue

      let body: unknown = undefined
      if (rawBody.trim()) {
        try {
          body = JSON.parse(rawBody)
        } catch {
          return Promise.resolve({
            statusCode: 400,
            headers: { 'content-type': 'application/json', 'access-control-allow-origin': corsOrigin },
            body: { error: 'bad_request', message: 'Invalid JSON in request body' },
          })
        }
      }

      const apiKey = ''
      const apiReq: ApiRequest = {
        method,
        path: pathPart,
        params,
        query,
        body,
        auth: { authenticated: false, userId: 'anonymous', permissions: [] },
      }

      const apiReqWithAuth: ApiRequest = {
        ...apiReq,
        auth: this.authenticate(apiKey),
      }

      return route
        .handler(apiReqWithAuth, this.context)
        .then((resp) => ({
          ...resp,
          headers: {
            ...resp.headers,
            'access-control-allow-origin': corsOrigin,
            'access-control-allow-methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
            'access-control-allow-headers': 'Content-Type, Authorization',
          },
        }))
        .catch((error) => {
          this.log.error('Route handler error', { error, method, url })
          return {
            statusCode: 500,
            headers: { 'content-type': 'application/json', 'access-control-allow-origin': corsOrigin },
            body: { error: 'internal_server_error', message: 'Internal server error' },
          }
        })
    }

    return Promise.resolve(null)
  }

  private authenticate(_apiKey: string): { authenticated: boolean; userId: string; permissions: string[] } {
    return { authenticated: true, userId: 'anonymous', permissions: ['*'] }
  }

  private writeResponse(res: http.ServerResponse, response: ApiResponse): void {
    const headers: Record<string, string> = {
      ...response.headers,
    }

    if (headers['content-type'] === 'application/json') {
      headers['content-type'] = 'application/json'
    } else if (!headers['content-type']) {
      headers['content-type'] = 'application/json'
    }

    res.writeHead(response.statusCode, headers)
    res.end(JSON.stringify(response.body))
  }

  private handleUpgrade(req: http.IncomingMessage, socket: import('node:net').Socket, head: Buffer): void {
    const url = req.url ?? ''

    if (url === '/ws') {
      this.log.info('WebSocket upgrade request received (placeholder)')
      socket.write('HTTP/1.1 101 Switching Protocols\r\n')
      socket.write('Upgrade: websocket\r\n')
      socket.write('Connection: Upgrade\r\n')
      socket.write('Sec-WebSocket-Accept: placeholder\r\n\r\n')
      socket.end()
    } else {
      socket.destroy()
    }
  }

  private parseQuery(queryString: string): Record<string, string> {
    const params: Record<string, string> = {}

    if (!queryString) return params

    for (const part of queryString.split('&')) {
      const [key, value] = part.split('=')
      if (key) {
        params[decodeURIComponent(key)] = value ? decodeURIComponent(value) : ''
      }
    }

    return params
  }
}
