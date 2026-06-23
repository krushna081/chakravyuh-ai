import { createInterface } from 'node:readline'

const GITHUB_API = 'https://api.github.com'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN ?? ''
const SERVER_NAME = 'github'

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

function validateBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`"${name}" must be a boolean`)
  return value
}

function validateOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined
  return validateString(value, name)
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'chakravyuh-ai-mcp-server-github',
  }
  if (GITHUB_TOKEN) headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`
  return headers
}

async function githubFetch(path: string, options: RequestInit = {}): Promise<{ status: number; data: unknown }> {
  const url = `${GITHUB_API}${path}`
  const response = await fetch(url, {
    ...options,
    headers: { ...buildHeaders(), ...((options.headers as Record<string, string>) ?? {}) },
  })

  let data: unknown
  const contentType = response.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    data = await response.json()
  } else {
    data = await response.text()
  }

  if (!response.ok) {
    throw new Error(`GitHub API error (${response.status}): ${JSON.stringify(data)}`)
  }

  return { status: response.status, data }
}

interface GitHubParams {
  owner?: string
  repo?: string
  [key: string]: unknown
}

function extractOwnerRepo(params: GitHubParams): { owner: string; repo: string } {
  const owner = validateString(params.owner, 'owner')
  const repo = validateString(params.repo, 'repo')
  return { owner, repo }
}

async function handleRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { id, method, params = {} } = req

  try {
    switch (method) {
      case 'create_pr': {
        const { owner, repo } = extractOwnerRepo(params as GitHubParams)
        const title = validateString(params.title, 'title')
        const head = validateString(params.head, 'head')
        const base = validateString(params.base, 'base')
        const body = validateOptionalString(params.body, 'body')
        const isDraft = typeof params.draft === 'boolean' ? params.draft : false
        const result = await githubFetch(`/repos/${owner}/${repo}/pulls`, {
          method: 'POST',
          body: JSON.stringify({ title, head, base, body, draft: isDraft }),
        })
        return makeResponse(id, result.data)
      }

      case 'review_pr': {
        const { owner, repo } = extractOwnerRepo(params as GitHubParams)
        const pullNumber = validateNumber(params.pullNumber, 'pullNumber')
        const body = validateString(params.body, 'body')
        const event = validateString(params.event, 'event')
        const result = await githubFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, {
          method: 'POST',
          body: JSON.stringify({ body, event }),
        })
        return makeResponse(id, result.data)
      }

      case 'merge_pr': {
        const { owner, repo } = extractOwnerRepo(params as GitHubParams)
        const pullNumber = validateNumber(params.pullNumber, 'pullNumber')
        const commitTitle = validateOptionalString(params.commitTitle, 'commitTitle')
        const commitMessage = validateOptionalString(params.commitMessage, 'commitMessage')
        const mergeMethod = (params.mergeMethod as string) ?? 'merge'
        const result = await githubFetch(`/repos/${owner}/${repo}/pulls/${pullNumber}/merge`, {
          method: 'PUT',
          body: JSON.stringify({ commit_title: commitTitle, commit_message: commitMessage, merge_method: mergeMethod }),
        })
        return makeResponse(id, result.data)
      }

      case 'list_issues': {
        const { owner, repo } = extractOwnerRepo(params as GitHubParams)
        const state = (params.state as string) ?? 'open'
        const labels = params.labels as string | undefined
        const sort = (params.sort as string) ?? 'created'
        const direction = (params.direction as string) ?? 'desc'
        const perPage = typeof params.perPage === 'number' ? params.perPage : 30
        const page = typeof params.page === 'number' ? params.page : 1
        let query = `/repos/${owner}/${repo}/issues?state=${state}&sort=${sort}&direction=${direction}&per_page=${perPage}&page=${page}`
        if (labels) query += `&labels=${encodeURIComponent(labels)}`
        const result = await githubFetch(query)
        return makeResponse(id, result.data)
      }

      case 'create_issue': {
        const { owner, repo } = extractOwnerRepo(params as GitHubParams)
        const title = validateString(params.title, 'title')
        const body = validateOptionalString(params.body, 'body')
        const labels = params.labels as string[] | undefined
        const assignees = params.assignees as string[] | undefined
        const result = await githubFetch(`/repos/${owner}/${repo}/issues`, {
          method: 'POST',
          body: JSON.stringify({ title, body, labels, assignees }),
        })
        return makeResponse(id, result.data)
      }

      case 'comment_on_issue': {
        const { owner, repo } = extractOwnerRepo(params as GitHubParams)
        const issueNumber = validateNumber(params.issueNumber, 'issueNumber')
        const body = validateString(params.body, 'body')
        const result = await githubFetch(`/repos/${owner}/${repo}/issues/${issueNumber}/comments`, {
          method: 'POST',
          body: JSON.stringify({ body }),
        })
        return makeResponse(id, result.data)
      }

      case 'list_repos': {
        const type = (params.type as string) ?? 'owner'
        const sort = (params.sort as string) ?? 'full_name'
        const direction = (params.direction as string) ?? 'asc'
        const perPage = typeof params.perPage === 'number' ? params.perPage : 30
        const page = typeof params.page === 'number' ? params.page : 1
        const result = await githubFetch(`/user/repos?type=${type}&sort=${sort}&direction=${direction}&per_page=${perPage}&page=${page}`)
        return makeResponse(id, result.data)
      }

      case 'get_repo': {
        const { owner, repo } = extractOwnerRepo(params as GitHubParams)
        const result = await githubFetch(`/repos/${owner}/${repo}`)
        return makeResponse(id, result.data)
      }

      case 'create_branch': {
        const { owner, repo } = extractOwnerRepo(params as GitHubParams)
        const branchName = validateString(params.branchName, 'branchName')
        const sourceBranch = validateString(params.sourceBranch, 'sourceBranch')
        const refResult = await githubFetch(`/repos/${owner}/${repo}/git/ref/heads/${sourceBranch}`)
        const refData = refResult.data as { object?: { sha?: string } }
        const sha = refData.object?.sha
        if (!sha) throw new Error('Could not get SHA of source branch')
        const result = await githubFetch(`/repos/${owner}/${repo}/git/refs`, {
          method: 'POST',
          body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
        })
        return makeResponse(id, result.data)
      }

      case 'list_branches': {
        const { owner, repo } = extractOwnerRepo(params as GitHubParams)
        const perPage = typeof params.perPage === 'number' ? params.perPage : 30
        const page = typeof params.page === 'number' ? params.page : 1
        const result = await githubFetch(`/repos/${owner}/${repo}/branches?per_page=${perPage}&page=${page}`)
        return makeResponse(id, result.data)
      }

      default:
        return makeResponse(id, undefined, makeError(-32601, `Method not found: ${method}`))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = message.includes('not found') ? 404 : message.includes('timed out') ? 408 : message.includes('rate limit') ? 429 : 500
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

process.stderr.write(`[${SERVER_NAME}] GitHub MCP server started\n`)
process.stderr.write(`[${SERVER_NAME}] GitHub token configured: ${GITHUB_TOKEN ? 'yes' : 'no'}\n`)
