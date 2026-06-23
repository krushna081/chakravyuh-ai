import crypto from 'node:crypto'
import { logger } from '../logger.js'

export interface AuthResult {
  authenticated: boolean
  userId: string
  permissions: string[]
  reason?: string
}

export interface JwtPayload {
  sub: string
  iss: string
  iat: number
  exp: number
  permissions: string[]
}

export interface AuthConfig {
  apiKeys: Map<string, { userId: string; permissions: string[] }>
  jwtSecret: string
  jwtIssuer: string
  jwtExpirySeconds: number
}

const log = logger.child({ source: 'Auth' })

export class Authenticator {
  private config: AuthConfig

  constructor(config?: Partial<AuthConfig>) {
    this.config = {
      apiKeys: config?.apiKeys ?? new Map(),
      jwtSecret: config?.jwtSecret ?? crypto.randomBytes(64).toString('hex'),
      jwtIssuer: config?.jwtIssuer ?? 'chakravyuh',
      jwtExpirySeconds: config?.jwtExpirySeconds ?? 3600,
    }
  }

  validateApiKey(apiKey: string): AuthResult {
    if (!apiKey) {
      return { authenticated: false, userId: '', permissions: [], reason: 'No API key provided' }
    }

    const entry = this.config.apiKeys.get(apiKey)
    if (!entry) {
      log.warn('Invalid API key used')
      return { authenticated: false, userId: '', permissions: [], reason: 'Invalid API key' }
    }

    return { authenticated: true, userId: entry.userId, permissions: entry.permissions }
  }

  createToken(payload: { sub: string; permissions: string[] }): string {
    const header = { alg: 'HS256', typ: 'JWT' }
    const now = Math.floor(Date.now() / 1000)

    const jwtPayload: JwtPayload = {
      sub: payload.sub,
      iss: this.config.jwtIssuer,
      iat: now,
      exp: now + this.config.jwtExpirySeconds,
      permissions: payload.permissions,
    }

    const base64UrlEncode = (data: Record<string, unknown>): string => {
      const json = JSON.stringify(data)
      const bytes = Buffer.from(json, 'utf-8')
      return bytes
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
    }

    const headerEncoded = base64UrlEncode(header)
    const payloadEncoded = base64UrlEncode(jwtPayload as unknown as Record<string, unknown>)

    const signature = crypto
      .createHmac('sha256', this.config.jwtSecret)
      .update(`${headerEncoded}.${payloadEncoded}`)
      .digest('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')

    return `${headerEncoded}.${payloadEncoded}.${signature}`
  }

  verifyToken(token: string): AuthResult {
    try {
      const parts = token.split('.')

      if (parts.length !== 3) {
        return { authenticated: false, userId: '', permissions: [], reason: 'Invalid token format' }
      }

      const [headerEncoded, payloadEncoded, signatureEncoded] = parts

      const expectedSignature = crypto
        .createHmac('sha256', this.config.jwtSecret)
        .update(`${headerEncoded}.${payloadEncoded}`)
        .digest('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')

      if (signatureEncoded !== expectedSignature) {
        return { authenticated: false, userId: '', permissions: [], reason: 'Invalid token signature' }
      }

      const base64UrlDecode = (str: string): string => {
        const padded = str.padEnd(str.length + ((4 - (str.length % 4)) % 4), '=')
        const normal = padded.replace(/-/g, '+').replace(/_/g, '/')
        return Buffer.from(normal, 'base64').toString('utf-8')
      }

      const payload: JwtPayload = JSON.parse(base64UrlDecode(payloadEncoded!))

      const now = Math.floor(Date.now() / 1000)
      if (payload.exp <= now) {
        return { authenticated: false, userId: '', permissions: [], reason: 'Token expired' }
      }

      return {
        authenticated: true,
        userId: payload.sub,
        permissions: payload.permissions,
      }
    } catch (error) {
      log.error('Token verification failed', { error })
      return { authenticated: false, userId: '', permissions: [], reason: 'Token verification failed' }
    }
  }

  authMiddleware(authHeader?: string): AuthResult {
    if (!authHeader) {
      return { authenticated: false, userId: '', permissions: [], reason: 'No authorization header' }
    }

    const apiKeyMatch = authHeader.match(/^ApiKey\s+(.+)$/i)
    if (apiKeyMatch) {
      return this.validateApiKey(apiKeyMatch[1]!)
    }

    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i)
    if (bearerMatch) {
      return this.verifyToken(bearerMatch[1]!)
    }

    return { authenticated: false, userId: '', permissions: [], reason: 'Unsupported authorization scheme' }
  }
}
