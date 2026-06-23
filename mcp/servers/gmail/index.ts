import { createInterface } from 'node:readline'

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? ''
const GOOGLE_ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN ?? ''
const SERVER_NAME = 'gmail'

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

function checkAuth(): void {
  if (!GOOGLE_ACCESS_TOKEN && !GOOGLE_API_KEY) {
    throw new Error('Google API not configured. Set GOOGLE_ACCESS_TOKEN or GOOGLE_API_KEY environment variable.')
  }
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  if (GOOGLE_ACCESS_TOKEN) headers['Authorization'] = `Bearer ${GOOGLE_ACCESS_TOKEN}`
  return headers
}

async function gmailFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const url = `https://gmail.googleapis.com/gmail/v1${path}${GOOGLE_API_KEY && !GOOGLE_ACCESS_TOKEN ? `?key=${GOOGLE_API_KEY}` : ''}`
  const response = await fetch(url, {
    ...options,
    headers: { ...buildHeaders(), ...((options.headers as Record<string, string>) ?? {}) },
  })
  if (!response.ok) {
    const data = await response.text()
    throw new Error(`Gmail API error (${response.status}): ${data}`)
  }
  return response.json()
}

async function handleRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { id, method, params = {} } = req

  try {
    checkAuth()

    switch (method) {
      case 'send_email': {
        const to = validateString(params.to, 'to')
        const subject = validateString(params.subject, 'subject')
        const body = validateString(params.body, 'body')
        const cc = validateOptionalString(params.cc, 'cc')
        const bcc = validateOptionalString(params.bcc, 'bcc')

        const emailLines = [
          `To: ${to}`,
          cc ? `Cc: ${cc}` : '',
          bcc ? `Bcc: ${bcc}` : '',
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          '',
          body,
        ].filter(Boolean).join('\n')

        const encodedEmail = Buffer.from(emailLines).toString('base64url')

        const result = await gmailFetch('/users/me/messages/send', {
          method: 'POST',
          body: JSON.stringify({ raw: encodedEmail }),
        })
        return makeResponse(id, result)
      }

      case 'list_emails': {
        const maxResults = typeof params.maxResults === 'number' ? Math.min(params.maxResults, 500) : 20
        const query = params.query as string | undefined
        let path = `/users/me/messages?maxResults=${maxResults}`
        if (query) path += `&q=${encodeURIComponent(query)}`
        const listResult = await gmailFetch(path) as { messages?: Array<{ id: string; threadId: string }>; resultSizeEstimate?: number }
        const messages = listResult.messages ?? []
        const emails = await Promise.all(
          messages.slice(0, maxResults).map(async (msg: { id: string }) => {
            const detail = await gmailFetch(`/users/me/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Subject&metadataHeaders=Date`)
            return detail
          }),
        )
        return makeResponse(id, { emails, total: listResult.resultSizeEstimate ?? emails.length })
      }

      case 'get_email': {
        const messageId = validateString(params.messageId, 'messageId')
        const format = (params.format as string) ?? 'full'
        if (!['minimal', 'full', 'raw', 'metadata'].includes(format)) {
          throw new Error(`Invalid format: ${format}. Supported: minimal, full, raw, metadata`)
        }
        const result = await gmailFetch(`/users/me/messages/${messageId}?format=${format}`)
        return makeResponse(id, result)
      }

      case 'search_emails': {
        const query = validateString(params.query, 'query')
        const maxResults = typeof params.maxResults === 'number' ? Math.min(params.maxResults, 500) : 20
        const result = await gmailFetch(`/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`)
        return makeResponse(id, result)
      }

      case 'create_draft': {
        const to = validateString(params.to, 'to')
        const subject = validateString(params.subject, 'subject')
        const body = validateString(params.body, 'body')

        const emailLines = [
          `To: ${to}`,
          `Subject: ${subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=UTF-8',
          '',
          body,
        ].join('\n')

        const encodedEmail = Buffer.from(emailLines).toString('base64url')
        const result = await gmailFetch('/users/me/drafts', {
          method: 'POST',
          body: JSON.stringify({ message: { raw: encodedEmail } }),
        })
        return makeResponse(id, result)
      }

      default:
        return makeResponse(id, undefined, makeError(-32601, `Method not found: ${method}`))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = message.includes('not found') ? 404 : message.includes('not configured') ? 401 : message.includes('rate limit') ? 429 : 500
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

process.stderr.write(`[${SERVER_NAME}] Gmail MCP server started\n`)
process.stderr.write(`[${SERVER_NAME}] Google API configured: ${!!(GOOGLE_ACCESS_TOKEN || GOOGLE_API_KEY)}\n`)
