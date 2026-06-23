import { createInterface } from 'node:readline'

const DEFAULT_TIMEOUT = 30_000
const MAX_RESPONSE_SIZE = 10 * 1024 * 1024
const SERVER_NAME = 'web-fetch'

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

interface FetchResult {
  url: string
  status: number
  statusText: string
  headers: Record<string, string>
  contentType: string
  content: string
  textContent?: string
  links?: string[]
  metadata?: Record<string, string | null>
  fetchTimeMs: number
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

function validateUrl(value: unknown): string {
  const url = validateString(value, 'url')
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Unsupported protocol: ${parsed.protocol}`)
    }
    return url
  } catch (error) {
    throw new Error(`Invalid URL: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function robotsTxtCheck(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url)
    const robotsUrl = `${parsed.protocol}//${parsed.host}/robots.txt`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    const response = await fetch(robotsUrl, { signal: controller.signal })
    clearTimeout(timeout)
    if (response.ok) {
      const text = await response.text()
      const pathname = parsed.pathname
      const lines = text.split('\n')
      let userAgentAll = false
      for (const line of lines) {
        const trimmed = line.trim().toLowerCase()
        if (trimmed.startsWith('user-agent:')) {
          userAgentAll = trimmed.includes('*')
        }
        if (userAgentAll && trimmed.startsWith('disallow:')) {
          const disallowed = trimmed.slice(9).trim()
          if (disallowed && pathname.startsWith(disallowed)) {
            return false
          }
        }
      }
    }
  } catch {
    // If robots.txt is unreachable, allow fetch
  }
  return true
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

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = []
  const regex = /<a[^>]+href=["']([^"']+)["']/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(html)) !== null) {
    try {
      const href = match[1]!
      const absolute = new URL(href, baseUrl).href
      if (absolute.startsWith('http://') || absolute.startsWith('https://')) {
        links.push(absolute)
      }
    } catch {
      // skip invalid URLs
    }
  }
  return [...new Set(links)]
}

function extractMetadata(html: string): Record<string, string | null> {
  const metadata: Record<string, string | null> = {}

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  metadata.title = titleMatch ? titleMatch[1]!.trim() : null

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i)
  metadata.description = descMatch ? descMatch[1]!.trim() : null

  const ogTitleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']*)["']/i)
  metadata.ogTitle = ogTitleMatch ? ogTitleMatch[1]!.trim() : null

  const ogDescMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']*)["']/i)
  metadata.ogDescription = ogDescMatch ? ogDescMatch[1]!.trim() : null

  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']*)["']/i)
  metadata.ogImage = ogImageMatch ? ogImageMatch[1]!.trim() : null

  const keywordsMatch = html.match(/<meta[^>]+name=["']keywords["'][^>]+content=["']([^"']*)["']/i)
  metadata.keywords = keywordsMatch ? keywordsMatch[1]!.trim() : null

  return metadata
}

async function fetchUrl(url: string, timeoutMs: number = DEFAULT_TIMEOUT, headers: Record<string, string> = {}): Promise<FetchResult> {
  const start = performance.now()
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChakravyuhAI/1.0; +https://chakravyuh.ai)',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...headers,
      },
    })

    const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => { responseHeaders[key] = value })

    const buffer = await response.arrayBuffer()
    const content = new TextDecoder('utf-8', { fatal: false }).decode(buffer.slice(0, MAX_RESPONSE_SIZE))

    const result: FetchResult = {
      url,
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
      contentType,
      content,
      fetchTimeMs: Math.round(performance.now() - start),
    }

    if (contentType.includes('text/html') || contentType.includes('application/xhtml')) {
      result.textContent = stripHtml(content)
      result.links = extractLinks(content, url)
      result.metadata = extractMetadata(content)
    } else if (contentType.startsWith('text/')) {
      result.textContent = content
    }

    return result
  } finally {
    clearTimeout(timeout)
  }
}

async function handleRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { id, method, params = {} } = req

  try {
    switch (method) {
      case 'fetch_url': {
        const url = validateUrl(params.url)
        const timeout = typeof params.timeout === 'number' ? params.timeout : DEFAULT_TIMEOUT
        const customHeaders = (params.headers as Record<string, string>) ?? {}

        const allowed = await robotsTxtCheck(url)
        if (!allowed) {
          return makeResponse(id, undefined, makeError(403, 'Blocked by robots.txt', { url }))
        }

        const result = await fetchUrl(url, timeout, customHeaders)
        return makeResponse(id, result)
      }

      case 'fetch_multiple': {
        const urls = params.urls
        if (!Array.isArray(urls) || urls.length === 0) {
          throw new Error('"urls" must be a non-empty array of strings')
        }
        const timeout = typeof params.timeout === 'number' ? params.timeout : DEFAULT_TIMEOUT
        const concurrency = typeof params.concurrency === 'number' ? Math.min(params.concurrency, 10) : 3

        const validatedUrls = urls.map((u: unknown) => validateUrl(u))
        const results: Array<{ url: string; success: boolean; data?: FetchResult; error?: string }> = []

        for (let i = 0; i < validatedUrls.length; i += concurrency) {
          const batch = validatedUrls.slice(i, i + concurrency)
          const batchResults = await Promise.allSettled(
            batch.map((url: string) => fetchUrl(url, timeout)),
          )
          for (let j = 0; j < batch.length; j++) {
            const r = batchResults[j]!
            if (r.status === 'fulfilled') {
              results.push({ url: batch[j]!, success: true, data: r.value })
            } else {
              results.push({ url: batch[j]!, success: false, error: r.reason instanceof Error ? r.reason.message : String(r.reason) })
            }
          }
        }

        return makeResponse(id, { results, total: results.length, successes: results.filter((r) => r.success).length, failures: results.filter((r) => !r.success).length })
      }

      case 'extract_text': {
        const url = validateUrl(params.url)
        const timeout = typeof params.timeout === 'number' ? params.timeout : DEFAULT_TIMEOUT
        const result = await fetchUrl(url, timeout)
        if (!result.textContent) {
          return makeResponse(id, { url, text: result.content, fetchTimeMs: result.fetchTimeMs })
        }
        return makeResponse(id, { url, text: result.textContent, fetchTimeMs: result.fetchTimeMs })
      }

      case 'extract_links': {
        const url = validateUrl(params.url)
        const timeout = typeof params.timeout === 'number' ? params.timeout : DEFAULT_TIMEOUT
        const result = await fetchUrl(url, timeout)
        return makeResponse(id, { url, links: result.links ?? [], total: result.links?.length ?? 0, fetchTimeMs: result.fetchTimeMs })
      }

      case 'extract_metadata': {
        const url = validateUrl(params.url)
        const timeout = typeof params.timeout === 'number' ? params.timeout : DEFAULT_TIMEOUT
        const result = await fetchUrl(url, timeout)
        return makeResponse(id, { url, metadata: result.metadata ?? {}, fetchTimeMs: result.fetchTimeMs })
      }

      default:
        return makeResponse(id, undefined, makeError(-32601, `Method not found: ${method}`))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = message.includes('timed out') || message.includes('abort') ? 408
      : message.includes('Invalid URL') || message.includes('Unsupported protocol') ? 400
      : message.includes('Blocked by robots.txt') ? 403
      : 500
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

process.stderr.write(`[${SERVER_NAME}] Web Fetch MCP server started\n`)
