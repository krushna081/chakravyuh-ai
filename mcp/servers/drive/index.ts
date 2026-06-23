import { createInterface } from 'node:readline'

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? ''
const GOOGLE_ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN ?? ''
const SERVER_NAME = 'drive'

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

async function driveFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const separator = path.includes('?') ? '&' : '?'
  const url = `https://www.googleapis.com/drive/v3${path}${GOOGLE_API_KEY && !GOOGLE_ACCESS_TOKEN ? `${separator}key=${GOOGLE_API_KEY}` : ''}`
  const response = await fetch(url, {
    ...options,
    headers: { ...buildHeaders(), ...((options.headers as Record<string, string>) ?? {}) },
  })
  if (!response.ok) {
    const data = await response.text()
    throw new Error(`Drive API error (${response.status}): ${data}`)
  }
  return response.json()
}

async function handleRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { id, method, params = {} } = req

  try {
    checkAuth()

    switch (method) {
      case 'list_files': {
        const pageSize = typeof params.pageSize === 'number' ? Math.min(params.pageSize, 100) : 20
        const query = params.query as string | undefined
        const orderBy = (params.orderBy as string) ?? 'modifiedTime desc'
        let path = `/files?pageSize=${pageSize}&orderBy=${encodeURIComponent(orderBy)}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,owners,webViewLink)`
        if (query) path += `&q=${encodeURIComponent(query)}`
        const result = await driveFetch(path)
        return makeResponse(id, result)
      }

      case 'upload_file': {
        const name = validateString(params.name, 'name')
        const content = validateString(params.content, 'content')
        const mimeType = (params.mimeType as string) ?? 'text/plain'
        const folderId = params.folderId as string | undefined

        const metadata: Record<string, unknown> = { name, mimeType }
        if (folderId) metadata.parents = [folderId]

        const boundary = 'chakravyuh_drive_boundary'
        const body = [
          `--${boundary}`,
          'Content-Type: application/json; charset=UTF-8',
          '',
          JSON.stringify(metadata),
          `--${boundary}`,
          `Content-Type: ${mimeType}`,
          '',
          content,
          `--${boundary}--`,
        ].join('\r\n')

        const result = await driveFetch('/files?uploadType=multipart', {
          method: 'POST',
          headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
          body,
        })
        return makeResponse(id, result)
      }

      case 'download_file': {
        const fileId = validateString(params.fileId, 'fileId')
        const result = await driveFetch(`/files/${fileId}?alt=media`)
        return makeResponse(id, { fileId, content: result as string })
      }

      case 'search_files': {
        const query = validateString(params.query, 'query')
        const pageSize = typeof params.pageSize === 'number' ? Math.min(params.pageSize, 100) : 20
        const result = await driveFetch(`/files?q=${encodeURIComponent(query)}&pageSize=${pageSize}&fields=files(id,name,mimeType,size,createdTime,modifiedTime,owners,webViewLink)`)
        return makeResponse(id, result)
      }

      case 'create_folder': {
        const name = validateString(params.name, 'name')
        const folderId = params.folderId as string | undefined
        const metadata: Record<string, unknown> = { name, mimeType: 'application/vnd.google-apps.folder' }
        if (folderId) metadata.parents = [folderId]

        const result = await driveFetch('/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metadata),
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

process.stderr.write(`[${SERVER_NAME}] Drive MCP server started\n`)
process.stderr.write(`[${SERVER_NAME}] Google API configured: ${!!(GOOGLE_ACCESS_TOKEN || GOOGLE_API_KEY)}\n`)
