import { spawn, execSync, exec } from 'node:child_process'
import { createInterface } from 'node:readline'
import { cwd } from 'node:process'

const DEFAULT_TIMEOUT = 30_000
const MAX_OUTPUT_SIZE = 1024 * 1024
const SERVER_NAME = 'terminal'

const COMMAND_WHITELIST: string[] = (process.env.COMMAND_WHITELIST ?? '*').split(',').map((s) => s.trim())
const DEFAULT_WORKING_DIRECTORY = process.env.SHELL_CWD ?? cwd()

const FORBIDDEN_PATTERNS = [
  /\bsudo\b/i,
  /\bsu\b/i,
  /\bpasswd\b/i,
  /`[^`]+`/,
  /\$\(/,
  /;\s*(rm|del|rd|format|shutdown|reboot|init)\b/i,
  /\|[\s]*\/dev\/null/,
  />\s*\/dev\/(null|zero|random)/,
]

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

function isCommandAllowed(command: string): boolean {
  if (COMMAND_WHITELIST.length === 1 && COMMAND_WHITELIST[0] === '*') return true
  const baseCommand = command.trim().split(/\s+/)[0]!
  return COMMAND_WHITELIST.some((allowed) => baseCommand === allowed || command.startsWith(allowed))
}

function containsForbiddenPatterns(command: string): boolean {
  return FORBIDDEN_PATTERNS.some((pattern) => pattern.test(command))
}

function validateCommand(command: string): void {
  if (!isCommandAllowed(command)) {
    throw new Error(`Command not in whitelist: ${command.split(/\s+/)[0]}. Allowed: ${COMMAND_WHITELIST.join(', ')}`)
  }
  if (containsForbiddenPatterns(command)) {
    throw new Error('Command contains forbidden patterns (sudo, shell injection, etc.)')
  }
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(command)) {
    throw new Error('Command contains control characters')
  }
}

async function handleRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { id, method, params = {} } = req

  try {
    switch (method) {
      case 'execute_command': {
        const command = validateString(params.command, 'command')
        const timeout = typeof params.timeout === 'number' ? params.timeout : DEFAULT_TIMEOUT
        const workdir = validateOptionalString(params.workdir, 'workdir') ?? DEFAULT_WORKING_DIRECTORY

        validateCommand(command)

        return new Promise((resolve) => {
          const child = spawn(command, [], {
            shell: process.platform === 'win32' ? 'powershell.exe' : true,
            cwd: workdir,
            timeout,
            maxBuffer: MAX_OUTPUT_SIZE,
            env: { ...process.env, PATH: process.env.PATH },
          })

          let stdout = ''
          let stderr = ''
          const startTime = performance.now()

          child.stdout?.on('data', (data: Buffer) => {
            stdout += data.toString()
            if (stdout.length > MAX_OUTPUT_SIZE) {
              stdout = stdout.slice(0, MAX_OUTPUT_SIZE) + '\n... [output truncated]'
              child.kill()
            }
          })

          child.stderr?.on('data', (data: Buffer) => {
            stderr += data.toString()
            if (stderr.length > MAX_OUTPUT_SIZE) {
              stderr = stderr.slice(0, MAX_OUTPUT_SIZE) + '\n... [output truncated]'
              child.kill()
            }
          })

          const timer = setTimeout(() => {
            child.kill()
            resolve(makeResponse(id, {
              stdout,
              stderr: stderr + '\nCommand timed out',
              exitCode: null,
              timedOut: true,
              durationMs: Math.round(performance.now() - startTime),
            }))
          }, timeout)

          child.on('close', (exitCode) => {
            clearTimeout(timer)
            resolve(makeResponse(id, {
              stdout,
              stderr,
              exitCode,
              timedOut: false,
              durationMs: Math.round(performance.now() - startTime),
            }))
          })

          child.on('error', (error) => {
            clearTimeout(timer)
            resolve(makeResponse(id, undefined, makeError(500, `Failed to execute command: ${error.message}`)))
          })
        })
      }

      case 'execute_script': {
        const script = validateString(params.script, 'script')
        const timeout = typeof params.timeout === 'number' ? params.timeout : DEFAULT_TIMEOUT
        const workdir = validateOptionalString(params.workdir, 'workdir') ?? DEFAULT_WORKING_DIRECTORY
        const language = (params.language as string) ?? 'powershell'

        const shell = language === 'powershell' ? 'powershell.exe' : language === 'bash' ? 'bash' : process.platform === 'win32' ? 'powershell.exe' : 'bash'

        return new Promise((resolve) => {
          const child = spawn(shell, ['-c', script], {
            cwd: workdir,
            timeout,
            maxBuffer: MAX_OUTPUT_SIZE,
          })

          let stdout = ''
          let stderr = ''
          const startTime = performance.now()

          child.stdout?.on('data', (data: Buffer) => { stdout += data.toString() })
          child.stderr?.on('data', (data: Buffer) => { stderr += data.toString() })

          const timer = setTimeout(() => {
            child.kill()
            resolve(makeResponse(id, {
              stdout,
              stderr: stderr + '\nScript timed out',
              exitCode: null,
              timedOut: true,
              durationMs: Math.round(performance.now() - startTime),
            }))
          }, timeout)

          child.on('close', (exitCode) => {
            clearTimeout(timer)
            resolve(makeResponse(id, {
              stdout,
              stderr,
              exitCode,
              timedOut: false,
              durationMs: Math.round(performance.now() - startTime),
            }))
          })

          child.on('error', (error) => {
            clearTimeout(timer)
            resolve(makeResponse(id, undefined, makeError(500, `Failed to execute script: ${error.message}`)))
          })
        })
      }

      case 'get_working_directory': {
        return makeResponse(id, { cwd: DEFAULT_WORKING_DIRECTORY })
      }

      case 'list_processes': {
        const command = process.platform === 'win32' ? 'tasklist /FO CSV /NH' : 'ps aux'
        const result = execSync(command, { encoding: 'utf-8', maxBuffer: MAX_OUTPUT_SIZE })
        const lines = result.trim().split('\n')

        let processes: Array<{ pid: number; name: string; cpu?: string; memory?: string }>
        if (process.platform === 'win32') {
          processes = lines.map((line) => {
            const parts = line.replace(/"/g, '').split(',')
            return { name: parts[0] ?? 'unknown', pid: parseInt(parts[1] ?? '0', 10) || 0, cpu: parts[2], memory: parts[4] }
          })
        } else {
          processes = lines.slice(1).map((line) => {
            const parts = line.split(/\s+/)
            return { pid: parseInt(parts[1] ?? '0', 10) || 0, name: parts[10] ?? 'unknown', cpu: parts[2], memory: parts[3] }
          })
        }

        return makeResponse(id, { processes, total: processes.length })
      }

      case 'kill_process': {
        const pid = validateNumber(params.pid, 'pid')
        const signal = (params.signal as string) ?? 'SIGTERM'
        try {
          process.kill(pid, signal)
          return makeResponse(id, { success: true, pid, signal })
        } catch (error) {
          return makeResponse(id, undefined, makeError(500, `Failed to kill process ${pid}: ${error instanceof Error ? error.message : String(error)}`))
        }
      }

      default:
        return makeResponse(id, undefined, makeError(-32601, `Method not found: ${method}`))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = message.includes('not in whitelist') || message.includes('forbidden') || message.includes('control characters') ? 403
      : message.includes('not found') ? 404
      : 500
    return makeResponse(id, undefined, makeError(code, message))
  }
}

function validateOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined
  return validateString(value, name)
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

process.stderr.write(`[${SERVER_NAME}] Terminal MCP server started\n`)
process.stderr.write(`[${SERVER_NAME}] Command whitelist: ${COMMAND_WHITELIST.join(', ')}\n`)
process.stderr.write(`[${SERVER_NAME}] Default working directory: ${DEFAULT_WORKING_DIRECTORY}\n`)
