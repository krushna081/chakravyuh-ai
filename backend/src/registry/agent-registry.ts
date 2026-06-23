import { EventEmitter } from 'node:events'
import { logger } from '../logger.js'
import { eventBus } from '../events/event-bus.js'
import { AgentError } from '../errors.js'
import type { AgentConfig, AgentMessage, ComponentHealth, ModelCapability } from '../types.js'

export interface AgentInstance {
  config: AgentConfig
  status: 'online' | 'offline' | 'busy' | 'error'
  lastHeartbeat: string
  errorCount: number
  metrics: {
    messagesProcessed: number
    totalTokensUsed: number
    averageLatencyMs: number
  }
}

export class AgentRegistry {
  private agents = new Map<string, AgentInstance>()
  private emitter = new EventEmitter()
  private messageHandlers = new Map<string, (msg: AgentMessage) => Promise<AgentMessage | void>>()

  private readonly heartbeatTimeoutMs: number

  constructor(heartbeatTimeoutMs = 30_000) {
    this.heartbeatTimeoutMs = heartbeatTimeoutMs
  }

  register(config: AgentConfig): void {
    if (this.agents.has(config.id)) {
      throw new AgentError(`Agent already registered: ${config.id}`)
    }

    const instance: AgentInstance = {
      config,
      status: 'online',
      lastHeartbeat: new Date().toISOString(),
      errorCount: 0,
      metrics: {
        messagesProcessed: 0,
        totalTokensUsed: 0,
        averageLatencyMs: 0,
      },
    }

    this.agents.set(config.id, instance)

    logger.info(`Agent registered: ${config.id} (${config.role})`, { source: 'AgentRegistry' })
    eventBus.publish('agent.registered', 'agent-registry', {
      agentId: config.id,
      role: config.role,
      tools: config.tools,
    })
  }

  deregister(agentId: string): boolean {
    const removed = this.agents.delete(agentId)
    if (removed) {
      this.messageHandlers.delete(agentId)
      logger.info(`Agent deregistered: ${agentId}`, { source: 'AgentRegistry' })
      eventBus.publish('agent.deregistered', 'agent-registry', { agentId })
    }
    return removed
  }

  getAgent(agentId: string): AgentInstance | undefined {
    return this.agents.get(agentId)
  }

  getAgentConfig(agentId: string): AgentConfig | undefined {
    return this.agents.get(agentId)?.config
  }

  getAllAgents(): AgentInstance[] {
    return Array.from(this.agents.values())
  }

  findAgentsByCapability(capability: ModelCapability): AgentInstance[] {
    return this.getAllAgents().filter((agent) => {
      if (typeof agent.config.provider === 'string') return true
      const strategy = agent.config.provider
      return !strategy.minCapability || strategy.minCapability === capability
    })
  }

  findAgentsByRole(role: string): AgentInstance[] {
    return this.getAllAgents().filter((a) =>
      a.config.role.toLowerCase().includes(role.toLowerCase()),
    )
  }

  findAgentByTool(toolName: string): AgentInstance[] {
    return this.getAllAgents().filter((a) =>
      a.config.tools.includes(toolName),
    )
  }

  getOnlineAgents(): AgentInstance[] {
    return this.getAllAgents().filter((a) => a.status === 'online')
  }

  updateHeartbeat(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.lastHeartbeat = new Date().toISOString()
      if (agent.status === 'offline') {
        agent.status = 'online'
        eventBus.publish('agent.online', 'agent-registry', { agentId })
      }
    }
  }

  markBusy(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent && agent.status === 'online') {
      agent.status = 'busy'
    }
  }

  markAvailable(agentId: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.status = 'online'
    }
  }

  markError(agentId: string, error?: string): void {
    const agent = this.agents.get(agentId)
    if (agent) {
      agent.status = 'error'
      agent.errorCount++
      logger.warn(`Agent ${agentId} marked error`, { source: 'AgentRegistry', error })
      eventBus.publish('agent.error', 'agent-registry', { agentId, error })
    }
  }

  registerMessageHandler(
    agentId: string,
    handler: (msg: AgentMessage) => Promise<AgentMessage | void>,
  ): void {
    if (!this.agents.has(agentId)) {
      throw new AgentError(`Cannot register handler for unknown agent: ${agentId}`)
    }
    this.messageHandlers.set(agentId, handler)
  }

  getMessageHandler(agentId: string): ((msg: AgentMessage) => Promise<AgentMessage | void>) | undefined {
    return this.messageHandlers.get(agentId)
  }

  async checkStaleAgents(): Promise<string[]> {
    const stale: string[] = []
    const now = Date.now()

    for (const [id, agent] of this.agents) {
      const lastBeat = new Date(agent.lastHeartbeat).getTime()
      if (now - lastBeat > this.heartbeatTimeoutMs) {
        agent.status = 'offline'
        stale.push(id)
        eventBus.publish('agent.offline', 'agent-registry', { agentId: id })
      }
    }

    return stale
  }

  updateMetrics(
    agentId: string,
    delta: { messagesProcessed?: number; tokensUsed?: number; latencyMs?: number },
  ): void {
    const agent = this.agents.get(agentId)
    if (!agent) return

    if (delta.messagesProcessed) {
      agent.metrics.messagesProcessed += delta.messagesProcessed
    }
    if (delta.tokensUsed) {
      agent.metrics.totalTokensUsed += delta.tokensUsed
    }
    if (delta.latencyMs) {
      const prev = agent.metrics.averageLatencyMs
      const count = agent.metrics.messagesProcessed
      agent.metrics.averageLatencyMs = (prev * (count - 1) + delta.latencyMs) / count
    }
  }

  async healthCheck(): Promise<ComponentHealth> {
    await this.checkStaleAgents()

    const total = this.agents.size
    const online = this.getOnlineAgents().length
    const errors = this.getAllAgents().filter((a) => a.status === 'error').length

    const status = errors > 0 ? 'degraded' : total === 0 ? 'unhealthy' : 'healthy'

    return {
      componentId: 'agent-registry',
      status,
      lastCheck: new Date().toISOString(),
      details: `${online}/${total} agents online, ${errors} errors`,
    }
  }

  onEvent(event: string, handler: (...args: unknown[]) => void): () => void {
    this.emitter.on(event, handler)
    return () => { this.emitter.off(event, handler) }
  }

  clear(): void {
    this.agents.clear()
    this.messageHandlers.clear()
    this.emitter.removeAllListeners()
  }
}
