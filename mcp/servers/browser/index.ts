import { createInterface } from 'node:readline'

const DEFAULT_TIMEOUT = 30_000
const SERVER_NAME = 'browser'

interface JSONRPCRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

interface Session {
  id: string
  url: string
  html: string
  textContent: string
  viewport: { width: number; height: number }
  scrollPosition: { x: number; y: number }
  cookies: Record<string, string>
  localStorage: Record<string, string>
  createdAt: number
  lastActivity: number
}

const sessions = new Map<string, Session>()
let sessionCounter = 0

function makeResponse(id: string | number, result?: unknown, error?: { code: number; message: string; data?: unknown }): JSONRPCResponse {
  return { jsonrpc: '2.0', id, ...(error ? { error } : { result }) }
}

function makeError(code: number, message: string, data?: unknown): { code: number; message: string; data?: unknown } {
  return { code, message, data }
}

function validateString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`"${name}" must be a non-empty string`)
  return value
}

function validateNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || isNaN(value)) throw new Error(`"${name}" must be a number`)
  return value
}

function validateOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined
  return validateString(value, name)
}

function getSession(sessionId: string): Session {
  const session = sessions.get(sessionId)
  if (!session) throw new Error(`Session not found: ${sessionId}`)
  session.lastActivity = Date.now()
  return session
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
}

async function httpGet(url: string, timeout: number): Promise<{ body: string; status: number; headers: Record<string, string> }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ChakravyuhAI-Browser/1.0)' },
    })
    const headers: Record<string, string> = {}
    response.headers.forEach((v, k) => { headers[k] = v })
    const body = await response.text()
    return { body, status: response.status, headers }
  } finally {
    clearTimeout(timer)
  }
}

async function handleRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { id, method, params = {} } = req

  try {
    switch (method) {
      case 'navigate': {
        const url = validateString(params.url, 'url')
        const timeout = typeof params.timeout === 'number' ? params.timeout : DEFAULT_TIMEOUT
        const width = typeof params.width === 'number' ? params.width : 1280
        const height = typeof params.height === 'number' ? params.height : 800

        const result = await httpGet(url, timeout)
        const textContent = stripHtml(result.body)

        const sessionId = params.sessionId as string || `session_${++sessionCounter}`
        const session: Session = {
          id: sessionId,
          url,
          html: result.body,
          textContent,
          viewport: { width, height },
          scrollPosition: { x: 0, y: 0 },
          cookies: {},
          localStorage: {},
          createdAt: Date.now(),
          lastActivity: Date.now(),
        }
        sessions.set(sessionId, session)

        return makeResponse(id, {
          sessionId,
          url,
          status: result.status,
          title: (result.body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim(),
          textLength: textContent.length,
          htmlLength: result.body.length,
        })
      }

      case 'click': {
        const session = getSession(validateString(params.sessionId, 'sessionId'))
        const selector = validateString(params.selector, 'selector')
        return makeResponse(id, {
          success: true,
          sessionId: session.id,
          selector,
          message: `Click on "${selector}" simulated (headless browser requires puppeteer/playwright for real interaction)`,
        })
      }

      case 'type': {
        const session = getSession(validateString(params.sessionId, 'sessionId'))
        const selector = validateString(params.selector, 'selector')
        const text = validateString(params.text, 'text')
        const clearFirst = typeof params.clearFirst === 'boolean' ? params.clearFirst : false
        return makeResponse(id, {
          success: true,
          sessionId: session.id,
          selector,
          text,
          clearFirst,
          message: `Typing "${text}" into "${selector}" simulated`,
        })
      }

      case 'screenshot': {
        const session = getSession(validateString(params.sessionId, 'sessionId'))
        const format = (params.format as string) ?? 'png'
        if (!['png', 'jpeg', 'webp'].includes(format)) {
          throw new Error(`Unsupported screenshot format: ${format}. Supported: png, jpeg, webp`)
        }
        return makeResponse(id, {
          success: true,
          sessionId: session.id,
          format,
          data: null,
          message: 'Screenshot requires puppeteer/playwright for real capture',
        })
      }

      case 'scroll': {
        const session = getSession(validateString(params.sessionId, 'sessionId'))
        const x = typeof params.x === 'number' ? params.x : session.scrollPosition.x
        const y = typeof params.y === 'number' ? params.y : session.scrollPosition.y

        if (params.by === 'amount') {
          session.scrollPosition.x += typeof params.x === 'number' ? params.x : 0
          session.scrollPosition.y += typeof params.y === 'number' ? params.y : 0
        } else {
          session.scrollPosition.x = x
          session.scrollPosition.y = y
        }

        return makeResponse(id, {
          success: true,
          sessionId: session.id,
          scrollPosition: { ...session.scrollPosition },
        })
      }

      case 'get_html': {
        const session = getSession(validateString(params.sessionId, 'sessionId'))
        const selector = validateOptionalString(params.selector, 'selector')
        if (selector) {
          const match = session.html.match(new RegExp(`<${selector}[^>]*>[\\s\\S]*?<\\/${selector}>`, 'i'))
          return makeResponse(id, {
            sessionId: session.id,
            selector,
            html: match ? match[0] : `Selector "${selector}" not found (simulated lookup)`,
          })
        }
        return makeResponse(id, { sessionId: session.id, html: session.html })
      }

      case 'extract_text': {
        const session = getSession(validateString(params.sessionId, 'sessionId'))
        return makeResponse(id, {
          sessionId: session.id,
          text: session.textContent,
          length: session.textContent.length,
        })
      }

      case 'fill_form': {
        const session = getSession(validateString(params.sessionId, 'sessionId'))
        const fields = params.fields
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
          throw new Error('"fields" must be an object with selector-value pairs')
        }
        const fieldCount = Object.keys(fields as Record<string, unknown>).length
        return makeResponse(id, {
          success: true,
          sessionId: session.id,
          fields: fields as Record<string, string>,
          fieldCount,
          message: `Form with ${fieldCount} field(s) filled (simulated)`,
        })
      }

      case 'execute_js': {
        const session = getSession(validateString(params.sessionId, 'sessionId'))
        const script = validateString(params.script, 'script')
        return makeResponse(id, {
          success: true,
          sessionId: session.id,
          result: null,
          message: `JavaScript execution requires puppeteer/playwright. Script: ${script.substring(0, 100)}`,
        })
      }

      default:
        return makeResponse(id, undefined, makeError(-32601, `Method not found: ${method}`))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = message.includes('not found') ? 404 : message.includes('timed out') ? 408 : 500
    return makeResponse(id, undefined, makeError(code, message))
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })

rl.on('line', async (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return

  let request: JSONRPCRequest
  try {
    request = JSON.parse(trimmed) as JSONRPCRequest
    if (request.jsonrpc !== '2.0' || !request.method) throw new Error('Invalid JSON-RPC 2.0 request')
  } catch (parseError) {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: null as unknown as string | number,
      error: { code: -32700, message: 'Parse error', data: parseError instanceof Error ? parseError.message : String(parseError) },
    }) + '\n')
    return
  }

  const response = await handleRequest(request)
  process.stdout.write(JSON.stringify(response) + '\n')
})

rl.on('close', () => process.exit(0))

process.on('uncaughtException', (error) => {
  process.stderr.write(`[${SERVER_NAME}] Uncaught exception: ${error.message}\n`)
  process.exit(1)
})

process.stderr.write(`[${SERVER_NAME}] Browser MCP server started\n`)
