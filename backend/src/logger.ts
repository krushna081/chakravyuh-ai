import { env } from 'node:process'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LOG_LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 }

const currentLevel: LogLevel =
  (env.CHAKRAVYUH_LOG_LEVEL as LogLevel | undefined) ?? (env.NODE_ENV === 'production' ? 'info' : 'debug')

const isJson = env.NODE_ENV === 'production' || env.CHAKRAVYUH_LOG_FORMAT === 'json'

function formatTimestamp(): string {
  return new Date().toISOString()
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel]
}

function serializePayload(payload: unknown): string {
  if (payload instanceof Error) {
    return JSON.stringify({ message: payload.message, stack: payload.stack, ...payload })
  }
  try {
    return JSON.stringify(payload)
  } catch {
    return String(payload)
  }
}

export interface LogContext {
  correlationId?: string
  source?: string
  [key: string]: unknown
}

export function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return

  const entry = {
    timestamp: formatTimestamp(),
    level,
    message,
    ...(context ?? {}),
  }

  if (isJson) {
    const output = JSON.stringify(entry)
    if (level === 'error') {
      console.error(output)
    } else if (level === 'warn') {
      console.warn(output)
    } else {
      console.log(output)
    }
  } else {
    const prefix = `[${entry.timestamp}] [${level.toUpperCase()}]`
    const src = context?.source ? ` (${context.source})` : ''
    const corr = context?.correlationId ? ` [${context.correlationId}]` : ''
    const base = `${prefix}${src}${corr} ${message}`

    if (level === 'error') {
      console.error(base, context ? serializePayload(context) : '')
    } else {
      console.log(base)
    }
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),

  child: (defaultContext: LogContext) => ({
    debug: (message: string, ctx?: LogContext) => log('debug', message, { ...defaultContext, ...ctx }),
    info: (message: string, ctx?: LogContext) => log('info', message, { ...defaultContext, ...ctx }),
    warn: (message: string, ctx?: LogContext) => log('warn', message, { ...defaultContext, ...ctx }),
    error: (message: string, ctx?: LogContext) => log('error', message, { ...defaultContext, ...ctx }),
  }),
}

export type Logger = typeof logger
