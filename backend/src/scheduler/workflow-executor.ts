import { randomUUID } from 'node:crypto'
import { EventEmitter } from 'node:events'
import { WorkflowParser, type ParsedWorkflow } from './workflow-parser.js'
import { MessageDispatcher } from '../router/dispatcher.js'
import { eventBus } from '../events/event-bus.js'
import { logger } from '../logger.js'
import { ValidationError } from '../errors.js'
import type {
  WorkflowDefinition,
  WorkflowStep,
  AgentMessage,
} from '../types.js'

export type StepState = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'waiting_approval'

export interface StepExecution {
  stepId: string
  state: StepState
  startedAt?: string
  completedAt?: string
  error?: string
  output?: string
  retryCount: number
}

export interface WorkflowExecution {
  id: string
  definitionId: string
  parsed: ParsedWorkflow
  steps: Map<string, StepExecution>
  state: 'pending' | 'running' | 'completed' | 'failed' | 'aborted'
  startedAt: string
  completedAt?: string
  error?: string
}

export class WorkflowExecutor {
  private parser: WorkflowParser
  private dispatcher: MessageDispatcher
  private emitter = new EventEmitter()
  private executions = new Map<string, WorkflowExecution>()
  private activeExecutions = 0
  private running = true

  constructor(parser: WorkflowParser, dispatcher: MessageDispatcher) {
    this.parser = parser
    this.dispatcher = dispatcher
  }

  async execute(def: WorkflowDefinition, context?: Record<string, unknown>): Promise<WorkflowExecution> {
    const parsed = this.parser.parse(def)
    const execution: WorkflowExecution = {
      id: randomUUID(),
      definitionId: def.id,
      parsed,
      steps: new Map(),
      state: 'pending',
      startedAt: new Date().toISOString(),
    }

    for (const step of def.steps) {
      execution.steps.set(step.id, {
        stepId: step.id,
        state: 'pending',
        retryCount: 0,
      })
    }

    this.executions.set(execution.id, execution)
    this.activeExecutions++

    eventBus.publish('workflow.started', 'workflow-executor', {
      executionId: execution.id,
      definitionId: def.id,
    })

    try {
      execution.state = 'running'
      await this.executeSteps(execution, def, context)
    } catch (error) {
      execution.state = 'failed'
      execution.error = error instanceof Error ? error.message : String(error)

      eventBus.publish('workflow.failed', 'workflow-executor', {
        executionId: execution.id,
        error: execution.error,
      })
    } finally {
      execution.completedAt = new Date().toISOString()
      if (execution.state === 'running') {
        execution.state = 'completed'

        eventBus.publish('workflow.completed', 'workflow-executor', {
          executionId: execution.id,
        })
      }
      this.activeExecutions--
    }

    return execution
  }

  private async executeSteps(
    execution: WorkflowExecution,
    def: WorkflowDefinition,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const steps = def.steps
    const stepMap = new Map(steps.map((s) => [s.id, s]))
    const completed = new Set<string>()
    const failed = new Set<string>()

    while (completed.size < steps.length) {
      const ready = this.findReadySteps(execution, stepMap, completed, failed)

      if (ready.length === 0 && completed.size + failed.size < steps.length) {
        throw new ValidationError('Workflow deadlocked - no steps are ready to execute')
      }

      const results = await Promise.allSettled(
        ready.map((step) => this.executeStep(execution, step, def, context)),
      )

      for (let i = 0; i < ready.length; i++) {
        const result = results[i]!
        const step = ready[i]!

        if (result.status === 'fulfilled') {
          completed.add(step.id)
          const stepExec = execution.steps.get(step.id)!
          stepExec.state = 'completed'
          stepExec.completedAt = new Date().toISOString()
        } else {
          const stepExec = execution.steps.get(step.id)!
          stepExec.state = 'failed'
          stepExec.error = result.reason instanceof Error ? result.reason.message : String(result.reason)

          const action = this.handleStepFailure(step, def, stepExec)
          if (action === 'abort') {
            execution.state = 'aborted'
            execution.error = `Step "${step.id}" failed: ${stepExec.error}`
            throw new Error(execution.error)
          } else if (action === 'skip') {
            failed.add(step.id)
            const skipped = this.findDependentSteps(step.id, steps)
            for (const s of skipped) {
              const se = execution.steps.get(s.id)!
              se.state = 'skipped'
              failed.add(s.id)
            }
            continue
          }
          failed.add(step.id)
        }
      }
    }
  }

  private findReadySteps(
    execution: WorkflowExecution,
    stepMap: Map<string, WorkflowStep>,
    completed: Set<string>,
    failed: Set<string>,
  ): WorkflowStep[] {
    const ready: WorkflowStep[] = []

    for (const [stepId, stepExec] of execution.steps) {
      if (stepExec.state !== 'pending') continue

      const step = stepMap.get(stepId)!
      const deps = step.depends_on ?? []

      const allDepsCompleted = deps.every((d) => completed.has(d))
      const anyDepFailed = deps.some((d) => failed.has(d))

      if (allDepsCompleted) {
        ready.push(step)
      } else if (anyDepFailed) {
        stepExec.state = 'skipped'
        failed.add(stepId)
      }
    }

    return ready
  }

  private async executeStep(
    execution: WorkflowExecution,
    step: WorkflowStep,
    def: WorkflowDefinition,
    context?: Record<string, unknown>,
  ): Promise<void> {
    const stepExec = execution.steps.get(step.id)!
    stepExec.state = 'running'
    stepExec.startedAt = new Date().toISOString()

    eventBus.publish(`workflow.step.started`, 'workflow-executor', {
      executionId: execution.id,
      stepId: step.id,
      agent: step.agent,
    })

    if (step.gates && step.gates.length > 0) {
      await this.processGates(step, stepExec, execution)
    }

    const message: AgentMessage = {
      id: randomUUID(),
      from: 'workflow-executor',
      to: step.agent,
      type: 'request',
      priority: 'high',
      payload: {
        task: step.task,
        data: context,
        context: { workflowId: execution.definitionId, executionId: execution.id, stepId: step.id },
      },
      metadata: {
        timestamp: new Date().toISOString(),
        ttl: 120_000,
        traceId: execution.id,
        correlationId: execution.id,
      },
    }

    try {
      const response = await this.sendWithRetry(step, message, def.maxRetries)
      stepExec.output = response?.payload?.data as string | undefined
      logger.info(`Step ${step.id} completed`, { source: 'WorkflowExecutor', executionId: execution.id })
    } catch (error) {
      stepExec.retryCount++
      throw error
    }
  }

  private async processGates(
    step: WorkflowStep,
    stepExec: StepExecution,
    execution: WorkflowExecution,
  ): Promise<void> {
    for (const gate of step.gates!) {
      if (gate.type === 'human_approval') {
        stepExec.state = 'waiting_approval'
        eventBus.publish('workflow.gate.human_approval', 'workflow-executor', {
          executionId: execution.id,
          stepId: step.id,
          message: gate.message,
        })
        const approved = await this.waitForHumanApproval(step.id, execution.id)
        if (!approved) {
          throw new Error(`Human approval denied for step "${step.id}"`)
        }
      }
    }
  }

  private async waitForHumanApproval(stepId: string, executionId: string): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false)
      }, 300_000)

      const unsub = eventBus.subscribe(`workflow.approval.${executionId}`, (event) => {
        const payload = event.payload as { stepId: string; approved: boolean }
        if (payload.stepId === stepId) {
          clearTimeout(timeout)
          unsub()
          resolve(payload.approved)
        }
      })
    })
  }

  private async sendWithRetry(
    step: WorkflowStep,
    message: AgentMessage,
    maxRetries: number,
  ): Promise<AgentMessage | void> {
    let lastError: Error | undefined
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await new Promise<AgentMessage | void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Step "${step.id}" timed out`))
          }, 120_000)

          this.dispatcher.dispatch(message).then(() => {
            clearTimeout(timeout)
            resolve()
          }).catch(reject)
        })
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        if (attempt < maxRetries) {
          logger.info(`Retrying step ${step.id} (attempt ${attempt + 2}/${maxRetries + 1})`, {
            source: 'WorkflowExecutor',
          })
        }
      }
    }
    throw lastError
  }

  private handleStepFailure(
    step: WorkflowStep,
    def: WorkflowDefinition,
    stepExec: StepExecution,
  ): 'abort' | 'skip' | 'notify_human' {
    eventBus.publish('workflow.step.failed', 'workflow-executor', {
      stepId: step.id,
      error: stepExec.error,
      definitionId: def.id,
    })

    if (stepExec.retryCount < def.maxRetries) {
      return 'notify_human'
    }

    return def.onFailure
  }

  private findDependentSteps(stepId: string, steps: WorkflowStep[]): WorkflowStep[] {
    return steps.filter((s) => s.depends_on?.includes(stepId))
  }

  getExecution(id: string): WorkflowExecution | undefined {
    return this.executions.get(id)
  }

  getActiveExecutions(): WorkflowExecution[] {
    return Array.from(this.executions.values()).filter((e) => e.state === 'running')
  }

  stop(): void {
    this.running = false
    this.emitter.removeAllListeners()
  }

  onStepComplete(handler: (execution: WorkflowExecution, step: WorkflowStep) => void): () => void {
    this.emitter.on('step-complete', handler)
    return () => { this.emitter.off('step-complete', handler) }
  }
}
