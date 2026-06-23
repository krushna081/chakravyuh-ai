import { EventEmitter } from 'node:events'
import { logger } from '../logger.js'
import { eventBus } from '../events/event-bus.js'
import { MCPError } from '../errors.js'
import type { ComponentHealth } from '../types.js'

export type ServiceType = 'mcp-server' | 'memory-backend' | 'embedding-service' | 'cache-service' | 'tool'

export interface ServiceDefinition {
  id: string
  name: string
  type: ServiceType
  version: string
  description?: string
  command?: string
  args?: string[]
  env?: Record<string, string>
  metadata?: Record<string, unknown>
}

export interface ServiceInstance {
  definition: ServiceDefinition
  status: 'running' | 'stopped' | 'error' | 'starting'
  pid?: number
  port?: number
  lastHeartbeat: string
  errorCount: number
  startedAt: string
  healthEndpoint?: string
}

export type ServiceHealthCheckFn = (service: ServiceInstance) => Promise<boolean>

export class ServiceRegistry {
  private services = new Map<string, ServiceInstance>()
  private healthChecks = new Map<string, ServiceHealthCheckFn>()
  private emitter = new EventEmitter()

  private readonly healthCheckIntervalMs: number

  constructor(healthCheckIntervalMs = 15_000) {
    this.healthCheckIntervalMs = healthCheckIntervalMs
  }

  register(definition: ServiceDefinition): void {
    if (this.services.has(definition.id)) {
      throw new MCPError(`Service already registered: ${definition.id}`)
    }

    const instance: ServiceInstance = {
      definition,
      status: 'starting',
      lastHeartbeat: new Date().toISOString(),
      errorCount: 0,
      startedAt: new Date().toISOString(),
    }

    this.services.set(definition.id, instance)

    logger.info(`Service registered: ${definition.id} (${definition.type})`, { source: 'ServiceRegistry' })
    eventBus.publish('mcp.registered', 'service-registry', {
      serviceId: definition.id,
      type: definition.type,
    })
  }

  deregister(serviceId: string): boolean {
    const removed = this.services.delete(serviceId)
    if (removed) {
      this.healthChecks.delete(serviceId)
      logger.info(`Service deregistered: ${serviceId}`, { source: 'ServiceRegistry' })
      eventBus.publish('mcp.deregistered', 'service-registry', { serviceId })
    }
    return removed
  }

  getService(serviceId: string): ServiceInstance | undefined {
    return this.services.get(serviceId)
  }

  getServicesByType(type: ServiceType): ServiceInstance[] {
    return Array.from(this.services.values()).filter((s) => s.definition.type === type)
  }

  getAllServices(): ServiceInstance[] {
    return Array.from(this.services.values())
  }

  getRunningServices(): ServiceInstance[] {
    return this.getAllServices().filter((s) => s.status === 'running')
  }

  markRunning(serviceId: string, meta?: { pid?: number; port?: number }): void {
    const service = this.services.get(serviceId)
    if (service) {
      service.status = 'running'
      services: if (meta) {
        if (meta.pid) service.pid = meta.pid
        if (meta.port) service.port = meta.port
      }
      service.lastHeartbeat = new Date().toISOString()
      eventBus.publish('mcp.running', 'service-registry', { serviceId })
    }
  }

  markStopped(serviceId: string): void {
    const service = this.services.get(serviceId)
    if (service) {
      service.status = 'stopped'
      eventBus.publish('mcp.stopped', 'service-registry', { serviceId })
    }
  }

  markError(serviceId: string, error?: string): void {
    const service = this.services.get(serviceId)
    if (service) {
      service.status = 'error'
      service.errorCount++
      logger.warn(`Service ${serviceId} error`, { source: 'ServiceRegistry', error })
      eventBus.publish('mcp.error', 'service-registry', { serviceId, error })
    }
  }

  updateHeartbeat(serviceId: string): void {
    const service = this.services.get(serviceId)
    if (service) {
      service.lastHeartbeat = new Date().toISOString()
    }
  }

  registerHealthCheck(serviceId: string, fn: ServiceHealthCheckFn): void {
    this.healthChecks.set(serviceId, fn)
  }

  resolveServiceReference(ref: string): ServiceInstance | undefined {
    return this.services.get(ref)
  }

  findToolsForAgent(agentTools: string[]): ServiceInstance[] {
    return this.getRunningServices().filter((s) =>
      agentTools.includes(s.definition.id),
    )
  }

  async runHealthChecks(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>()

    for (const [serviceId, checkFn] of this.healthChecks) {
      const service = this.services.get(serviceId)
      if (!service) continue

      try {
        const healthy = await checkFn(service)
        results.set(serviceId, healthy)

        if (!healthy) {
          service.status = 'error'
          service.errorCount++
          eventBus.publish('mcp.health_failed', 'service-registry', { serviceId })
        } else {
          service.lastHeartbeat = new Date().toISOString()
        }
      } catch {
        results.set(serviceId, false)
        service.status = 'error'
        service.errorCount++
      }
    }

    return results
  }

  async healthCheck(): Promise<ComponentHealth> {
    const total = this.services.size
    const running = this.getRunningServices().length
    const errors = this.getAllServices().filter((s) => s.status === 'error').length

    const status = errors > 0 ? 'degraded' : total === 0 ? 'unhealthy' : 'healthy'

    return {
      componentId: 'service-registry',
      status,
      lastCheck: new Date().toISOString(),
      details: `${running}/${total} services running, ${errors} errors`,
    }
  }

  onEvent(event: string, handler: (...args: unknown[]) => void): () => void {
    this.emitter.on(event, handler)
    return () => { this.emitter.off(event, handler) }
  }

  clear(): void {
    this.services.clear()
    this.healthChecks.clear()
    this.emitter.removeAllListeners()
  }
}
