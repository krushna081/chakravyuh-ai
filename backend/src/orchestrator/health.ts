import { logger } from '../logger.js'

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface ComponentHealth {
  componentId: string
  status: HealthStatus
  lastCheck: string
  details?: string
  latencyMs?: number
}

export interface HealthReport {
  status: HealthStatus
  timestamp: string
  uptime: number
  components: ComponentHealth[]
  summary: {
    total: number
    healthy: number
    degraded: number
    unhealthy: number
  }
}

export interface HealthCheckFn {
  (): Promise<ComponentHealth>
}

interface CircuitBreakerState {
  failures: number
  lastFailure: string | null
  state: 'closed' | 'open' | 'half-open'
  lastStateChange: string
}

export class HealthChecker {
  private checks = new Map<string, HealthCheckFn>()
  private cache = new Map<string, ComponentHealth>()
  private circuitBreakers = new Map<string, CircuitBreakerState>()
  private startTime = Date.now()

  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number
  private readonly cacheTtlMs: number

  constructor(opts?: { failureThreshold?: number; resetTimeoutMs?: number; cacheTtlMs?: number }) {
    this.failureThreshold = opts?.failureThreshold ?? 3
    this.resetTimeoutMs = opts?.resetTimeoutMs ?? 30_000
    this.cacheTtlMs = opts?.cacheTtlMs ?? 5_000
  }

  register(componentId: string, fn: HealthCheckFn): void {
    this.checks.set(componentId, fn)
    this.circuitBreakers.set(componentId, {
      failures: 0,
      lastFailure: null,
      state: 'closed',
      lastStateChange: new Date().toISOString(),
    })
  }

  deregister(componentId: string): void {
    this.checks.delete(componentId)
    this.circuitBreakers.delete(componentId)
    this.cache.delete(componentId)
  }

  async checkComponent(componentId: string): Promise<ComponentHealth> {
    const fn = this.checks.get(componentId)
    if (!fn) {
      return {
        componentId,
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: 'No health check registered',
      }
    }

    const cb = this.circuitBreakers.get(componentId)
    if (cb && cb.state === 'open') {
      const elapsed = Date.now() - new Date(cb.lastStateChange).getTime()
      if (elapsed < this.resetTimeoutMs) {
        return {
          componentId,
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          details: `Circuit breaker open (${cb.failures} failures)`,
        }
      }
      cb.state = 'half-open'
      cb.lastStateChange = new Date().toISOString()
    }

    try {
      const result = await fn()
      this.cache.set(componentId, result)

      if (cb) {
        cb.failures = 0
        cb.state = 'closed'
      }

      return result
    } catch (error) {
      const health: ComponentHealth = {
        componentId,
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: error instanceof Error ? error.message : String(error),
      }
      this.cache.set(componentId, health)

      const breaker = this.circuitBreakers.get(componentId)
      if (breaker) {
        breaker.failures++
        breaker.lastFailure = new Date().toISOString()
        if (breaker.failures >= this.failureThreshold) {
          breaker.state = 'open'
          breaker.lastStateChange = new Date().toISOString()
          logger.warn(`Circuit breaker opened for ${componentId}`, { source: 'HealthChecker' })
        }
      }

      return health
    }
  }

  async checkAll(): Promise<HealthReport> {
    const componentIds = Array.from(this.checks.keys())
    const results = await Promise.allSettled(
      componentIds.map((id) => this.checkComponent(id)),
    )

    const components: ComponentHealth[] = results.map((r, i) => {
      if (r.status === 'fulfilled') return r.value
      return {
        componentId: componentIds[i]!,
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: r.reason instanceof Error ? r.reason.message : String(r.reason),
      }
    })

    return this.buildReport(components)
  }

  async getReport(): Promise<HealthReport> {
    const now = Date.now()
    const cached: ComponentHealth[] = []

    for (const [id, health] of this.cache) {
      const age = now - new Date(health.lastCheck).getTime()
      if (age < this.cacheTtlMs) {
        cached.push(health)
      }
    }

    const uncached = Array.from(this.checks.keys()).filter((id) => !cached.some((c) => c.componentId === id))

    const fresh = await Promise.allSettled(
      uncached.map((id) => this.checkComponent(id)),
    )

    const components = [
      ...cached,
      ...fresh.map((r, i) => {
        if (r.status === 'fulfilled') return r.value
        return {
          componentId: uncached[i]!,
          status: 'unhealthy' as HealthStatus,
          lastCheck: new Date().toISOString(),
          details: r.reason instanceof Error ? r.reason.message : String(r.reason),
        }
      }),
    ]

    return this.buildReport(components)
  }

  private buildReport(components: ComponentHealth[]): HealthReport {
    const healthy = components.filter((c) => c.status === 'healthy').length
    const degraded = components.filter((c) => c.status === 'degraded').length
    const unhealthy = components.filter((c) => c.status === 'unhealthy').length

    let overall: HealthStatus = 'healthy'
    if (unhealthy > 0) overall = 'unhealthy'
    else if (degraded > 0) overall = 'degraded'

    return {
      status: overall,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      components,
      summary: { total: components.length, healthy, degraded, unhealthy },
    }
  }

  resetCircuitBreaker(componentId: string): void {
    const cb = this.circuitBreakers.get(componentId)
    if (cb) {
      cb.failures = 0
      cb.state = 'closed'
      cb.lastStateChange = new Date().toISOString()
      logger.info(`Circuit breaker reset for ${componentId}`, { source: 'HealthChecker' })
    }
  }
}
