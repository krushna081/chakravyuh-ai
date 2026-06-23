import { readFile, writeFile, unlink, readdir, stat, access, mkdir } from 'node:fs/promises'
import { join, resolve, normalize, relative, isAbsolute } from 'node:path'
import { createReadStream, createWriteStream } from 'node:fs'
import { createInterface } from 'node:readline'

const ALLOWED_DIRECTORIES: string[] = (process.env.ALLOWED_DIRECTORIES ?? process.cwd()).split(';').map((d) => resolve(d.trim()))

const SERVER_NAME = 'filesystem'

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

function safePath(input: string): string {
  const resolved = resolve(input)
  const normalized = normalize(resolved)

  for (const allowed of ALLOWED_DIRECTORIES) {
    if (normalized.startsWith(allowed)) {
      return normalized
    }
  }

  throw new Error(`Path "${input}" is outside allowed directories: ${ALLOWED_DIRECTORIES.join(', ')}`)
}

function makeResponse(id: string | number, result?: unknown, error?: { code: number; message: string; data?: unknown }): JSONRPCResponse {
  return { jsonrpc: '2.0', id, ...(error ? { error } : { result }) }
}

function makeError(code: number, message: string, data?: unknown): { code: number; message: string; data?: unknown } {
  return { code, message, data }
}

function validateString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`"${name}" must be a non-empty string`)
  }
  return value
}

function validateBoolean(value: unknown, name: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`"${name}" must be a boolean`)
  }
  return value
}

async function handleRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { id, method, params = {} } = req

  try {
    switch (method) {
      case 'read_file': {
        const filePath = safePath(validateString(params.path, 'path'))
        const encoding = (params.encoding as string) ?? 'utf-8'
        const content = await readFile(filePath, encoding as BufferEncoding)
        return makeResponse(id, { content })
      }

      case 'write_file': {
        const filePath = safePath(validateString(params.path, 'path'))
        const content = validateString(params.content, 'content')
        await mkdir(resolve(filePath, '..'), { recursive: true })
        await writeFile(filePath, content, 'utf-8')
        return makeResponse(id, { success: true })
      }

      case 'edit_file': {
        const filePath = safePath(validateString(params.path, 'path'))
        const oldContent = validateString(params.oldContent, 'oldContent')
        const newContent = validateString(params.newContent, 'newContent')
        const current = await readFile(filePath, 'utf-8')
        if (!current.includes(oldContent)) {
          return makeResponse(id, undefined, makeError(404, 'oldContent not found in file', { path: filePath }))
        }
        const updated = current.replace(oldContent, newContent)
        await writeFile(filePath, updated, 'utf-8')
        return makeResponse(id, { success: true })
      }

      case 'delete_file': {
        const filePath = safePath(validateString(params.path, 'path'))
        await unlink(filePath)
        return makeResponse(id, { success: true })
      }

      case 'list_directory': {
        const dirPath = safePath(validateString(params.path, 'path'))
        const entries = await readdir(dirPath, { withFileTypes: true })
        const items = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = join(dirPath, entry.name)
            try {
              const s = await stat(fullPath)
              return {
                name: entry.name,
                path: fullPath,
                isDirectory: entry.isDirectory(),
                size: s.size,
                created: s.birthtime.toISOString(),
                modified: s.mtime.toISOString(),
              }
            } catch {
              return {
                name: entry.name,
                path: fullPath,
                isDirectory: entry.isDirectory(),
                size: 0,
                created: null,
                modified: null,
              }
            }
          }),
        )
        return makeResponse(id, { items, total: items.length })
      }

      case 'search_files': {
        const dirPath = safePath(validateString(params.path, 'path'))
        const pattern = validateString(params.pattern, 'pattern')
        const maxDepth = typeof params.maxDepth === 'number' ? params.maxDepth : -1
        const results: Array<{ path: string; name: string; isDirectory: boolean; size: number }> = []

        async function walk(dir: string, depth: number): Promise<void> {
          if (maxDepth >= 0 && depth > maxDepth) return
          try {
            const entries = await readdir(dir, { withFileTypes: true })
            for (const entry of entries) {
              const fullPath = join(dir, entry.name)
              if (entry.name.includes(pattern) || entry.name.match(pattern)) {
                try {
                  const s = await stat(fullPath)
                  results.push({ path: fullPath, name: entry.name, isDirectory: entry.isDirectory(), size: s.size })
                } catch {
                  results.push({ path: fullPath, name: entry.name, isDirectory: entry.isDirectory(), size: 0 })
                }
              }
              if (entry.isDirectory()) {
                await walk(fullPath, depth + 1)
              }
            }
          } catch {
            // skip unreadable directories
          }
        }

        await walk(dirPath, 0)
        return makeResponse(id, { files: results, total: results.length })
      }

      case 'get_file_info': {
        const filePath = safePath(validateString(params.path, 'path'))
        const s = await stat(filePath)
        const canRead = await access(filePath).then(() => true).catch(() => false)
        return makeResponse(id, {
          path: filePath,
          size: s.size,
          isDirectory: s.isDirectory(),
          isFile: s.isFile(),
          isSymlink: s.isSymbolicLink(),
          created: s.birthtime.toISOString(),
          modified: s.mtime.toISOString(),
          accessed: s.atime.toISOString(),
          mode: s.mode,
          readable: canRead,
        })
      }

      default:
        return makeResponse(id, undefined, makeError(-32601, `Method not found: ${method}`))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = message.includes('outside allowed directories') ? 400 : message.includes('ENOENT') || message.includes('not found') ? 404 : 500
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
    if (request.jsonrpc !== '2.0' || !request.method) {
      throw new Error('Invalid JSON-RPC 2.0 request')
    }
  } catch (parseError) {
    const errorResp: JSONRPCResponse = {
      jsonrpc: '2.0',
      id: null as unknown as string | number,
      error: { code: -32700, message: 'Parse error', data: parseError instanceof Error ? parseError.message : String(parseError) },
    }
    process.stdout.write(JSON.stringify(errorResp) + '\n')
    return
  }

  const response = await handleRequest(request)
  process.stdout.write(JSON.stringify(response) + '\n')
})

rl.on('close', () => {
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  process.stderr.write(`[${SERVER_NAME}] Uncaught exception: ${error.message}\n`)
  process.exit(1)
})

process.stderr.write(`[${SERVER_NAME}] Filesystem MCP server started\n`)
process.stderr.write(`[${SERVER_NAME}] Allowed directories: ${ALLOWED_DIRECTORIES.join(', ')}\n`)
