import { EventEmitter } from 'node:events'
import { LifecycleManager, LifecycleState } from './lifecycle.js'
import { HealthChecker, type HealthReport } from './health.js'
import { EventBus, eventBus } from '../events/event-bus.js'
import { MessageRouter } from '../router/message-router.js'
import { MessageDispatcher } from '../router/dispatcher.js'
import { WorkflowParser } from '../scheduler/workflow-parser.js'
import { WorkflowExecutor } from '../scheduler/workflow-executor.js'
import { AgentRegistry } from '../registry/agent-registry.js'
import { ServiceRegistry } from '../registry/service-registry.js'
import { TaskAnalyzer } from '../analyzer/task-analyzer.js'
import { ConfigManager } from '../config/loader.js'
import { logger } from '../logger.js'

export interface EngineOptions {
  configDir?: string
  healthCheckIntervalMs?: number
}

export class Engine {
  public readonly lifecycle: LifecycleManager
  public readonly health: HealthChecker
  public readonly events: EventBus
  public readonly router: MessageRouter
  public readonly dispatcher: MessageDispatcher
  public readonly workflowParser: WorkflowParser
  public readonly workflowExecutor: WorkflowExecutor
  public readonly agentRegistry: AgentRegistry
  public readonly serviceRegistry: ServiceRegistry
  public readonly taskAnalyzer: TaskAnalyzer
  public readonly config: ConfigManager

  private emitter = new EventEmitter()
  private healthInterval: ReturnType<typeof setInterval> | null = null
  private shutdownTimer: ReturnType<typeof setTimeout> | null = null
  private readonly healthCheckIntervalMs: number

  constructor(opts: EngineOptions = {}) {
    this.healthCheckIntervalMs = opts.healthCheckIntervalMs ?? 30_000

    this.lifecycle = new LifecycleManager()
    this.health = new HealthChecker()
    this.events = eventBus
    this.config = new ConfigManager(opts.configDir)
    this.router = new MessageRouter()
    this.dispatcher = new MessageDispatcher()
    this.workflowParser = new WorkflowParser()
    this.workflowExecutor = new WorkflowExecutor(this.workflowParser, this.dispatcher)
    this.agentRegistry = new AgentRegistry()
    this.serviceRegistry = new ServiceRegistry()
    this.taskAnalyzer = new TaskAnalyzer()

    this.setupLifecycleListeners()
  }

  private setupLifecycleListeners(): void {
    this.lifecycle.onTransition((event) => {
      this.events.publish('system.lifecycle', 'engine', event)
      this.emitter.emit('lifecycle', event)
    })
  }

  async start(): Promise<void> {
    if (!this.lifecycle.canStart()) {
      throw new Error(`Cannot start engine from state ${this.lifecycle.state}`)
    }

    this.lifecycle.transition(LifecycleState.Starting)
    logger.info('Engine starting...', { source: 'Engine' })

    try {
      await this.config.loadAll()

      this.health.register('config', () => this.config.healthCheck())
      this.health.register('agent-registry', () => this.agentRegistry.healthCheck())
      this.health.register('service-registry', () => this.serviceRegistry.healthCheck())
      this.health.register('router', () => this.router.healthCheck())
      this.health.register('dispatcher', () => this.dispatcher.healthCheck())

      this.dispatcher.setAgentLookup((id) => this.agentRegistry.getAgent(id))

      this.setupSignalHandlers()

      this.healthInterval = setInterval(() => {
        this.runHealthCheck().catch((err) => {
          logger.error('Health check cycle failed', { source: 'Engine', error: err })
        })
      }, this.healthCheckIntervalMs)

      this.lifecycle.transition(LifecycleState.Running)
      this.events.publish('system.started', 'engine', { timestamp: new Date().toISOString() })
      logger.info('Engine started successfully', { source: 'Engine' })
    } catch (error) {
      this.lifecycle.transition(LifecycleState.Error)
      logger.error('Engine failed to start', { source: 'Engine', error })
      throw error
    }
  }

  async stop(): Promise<void> {
    if (this.lifecycle.isStopped() || this.lifecycle.isStopping()) return

    this.lifecycle.transition(LifecycleState.Stopping)
    logger.info('Engine stopping...', { source: 'Engine' })

    this.events.publish('system.stopping', 'engine', { timestamp: new Date().toISOString() })

    if (this.healthInterval) {
      clearInterval(this.healthInterval)
      this.healthInterval = null
    }

    this.workflowExecutor.stop()
    this.router.clear()

    this.lifecycle.transition(LifecycleState.Stopped)
    this.events.publish('system.stopped', 'engine', { timestamp: new Date().toISOString() })
    logger.info('Engine stopped', { source: 'Engine' })
  }

  async shutdown(timeoutMs = 10_000): Promise<void> {
    logger.info('Engine shutdown initiated', { source: 'Engine' })

    const timeout = new Promise<void>((_, reject) => {
      this.shutdownTimer = setTimeout(() => {
        reject(new Error(`Shutdown timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    try {
      await Promise.race([this.stop(), timeout])
    } catch (error) {
      logger.error('Shutdown error', { source: 'Engine', error })
    } finally {
      if (this.shutdownTimer) {
        clearTimeout(this.shutdownTimer)
        this.shutdownTimer = null
      }
    }
  }

  async isHealthy(): Promise<HealthReport> {
    return this.health.getReport()
  }

  private async runHealthCheck(): Promise<void> {
    const report = await this.health.checkAll()
    this.events.publish('system.health', 'engine', report)

    if (report.status === 'unhealthy') {
      logger.warn('Engine health: UNHEALTHY', {
        source: 'Engine',
        unhealthy: report.summary.unhealthy,
        degraded: report.summary.degraded,
      })
    }
  }

  private setupSignalHandlers(): void {
    const handleSignal = async () => {
      logger.info('Shutdown signal received', { source: 'Engine' })
      await this.shutdown()
    }

    process.once('SIGINT', handleSignal)
    process.once('SIGTERM', handleSignal)
  }

  onLifecycle(handler: (event: unknown) => void): () => void {
    this.emitter.on('lifecycle', handler)
    return () => { this.emitter.off('lifecycle', handler) }
  }
}
