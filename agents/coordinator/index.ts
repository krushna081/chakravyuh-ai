import { BaseAgent } from '../base'
import type { AgentMessage, TaskAnalysis, WorkflowDefinition } from '@chakravyuh/core'
import { AgentError } from '@chakravyuh/core/errors'
import { randomUUID } from 'node:crypto'

interface TaskClassificationResult {
  type: TaskAnalysis['type']
  complexity: TaskAnalysis['complexity']
  sensitivity: TaskAnalysis['sensitivity']
  targetAgent: string
  confidence: number
  reasoning: string
}

const AGENT_CAPABILITIES: Record<string, TaskAnalysis['type'][]> = {
  planner: ['plan'],
  coder: ['code'],
  researcher: ['research'],
  browser: ['browse'],
  qa: ['test'],
  memory: ['memory'],
  security: ['security'],
  deployment: ['deploy'],
}

export class CoordinatorAgent extends BaseAgent {
  private pendingTasks: Map<string, { message: AgentMessage; startedAt: number; timeout: NodeJS.Timeout }> = new Map()
  private gatherResults: Map<string, AgentMessage[]> = new Map()

  async onStart(): Promise<void> {
    this.eventBus.subscribe(`agent.*.started`, (event) => {
      this.logger.debug('Peer agent started', { agentId: event.payload })
    })
    this.eventBus.subscribe(`agent.*.error`, (event) => {
      this.logger.warn('Peer agent error', { agentId: event.payload })
    })
  }

  async onStop(): Promise<void> {
    for (const [taskId, entry] of this.pendingTasks) {
      clearTimeout(entry.timeout)
      this.logger.warn('Pending task cancelled on stop', { taskId })
    }
    this.pendingTasks.clear()
    this.gatherResults.clear()
  }

  async onMessage(message: AgentMessage): Promise<AgentMessage> {
    const taskText = message.payload.task ?? ''
    const context = message.payload.context ?? {}

    this.logger.info('Received task', { task: taskText.slice(0, 100), from: message.from, traceId: message.metadata.traceId })

    const classification = await this.classifyTask(taskText, context)

    if (classification.confidence < 0.4) {
      return this.reply(message, {
        data: {
          error: 'Unable to classify task with sufficient confidence',
          classification,
        },
      })
    }

    if (classification.targetAgent === 'planner' && classification.complexity === 'complex') {
      return this.handleComplexGoal(message, classification)
    }

    if (this.requiresScatterGather(taskText, classification)) {
      return this.handleScatterGather(message, classification)
    }

    return this.delegateToAgent(message, classification.targetAgent, classification)
  }

  async onError(error: Error, message: AgentMessage): Promise<void> {
    this.logger.error('Coordinator error', { error: error.message, taskId: message.id })

    if (message.metadata.parentId) {
      const parentTask = this.pendingTasks.get(message.metadata.parentId)
      if (parentTask) {
        const retryCount = (parentTask.message.payload.context?.retryCount as number) ?? 0
        if (retryCount < 2) {
          this.logger.info('Retrying delegated task', { parentId: message.metadata.parentId, retryCount })
          const updatedContext = { ...parentTask.message.payload.context, retryCount: retryCount + 1 }
          await this.delegateToAgent(
            { ...parentTask.message, payload: { ...parentTask.message.payload, context: updatedContext } },
            message.to as string,
          )
          return
        }
      }
    }

    this.broadcast('coordinator.error', {
      taskId: message.id,
      error: error.message,
      traceId: message.metadata.traceId,
    })
  }

  private async classifyTask(task: string, context: Record<string, unknown>): Promise<TaskClassificationResult> {
    const taskLower = task.toLowerCase()

    const patterns: Array<{
      keywords: RegExp
      type: TaskAnalysis['type']
      agent: string
    }> = [
      { keywords: /\b(code|implement|write|refactor|create\s+function|add\s+feature|fix\s+build)\b/i, type: 'code', agent: 'coder' },
      { keywords: /\b(search|research|find|look\s+up|investigate|what\s+is|how\s+does|compare)\b/i, type: 'research', agent: 'researcher' },
      { keywords: /\b(browse|navigate|goto|open\s+url|click|scrape|screenshot)\b/i, type: 'browse', agent: 'browser' },
      { keywords: /\b(plan|break\s+down|steps|workflow|pipeline|sequence|orchestrate)\b/i, type: 'plan', agent: 'planner' },
      { keywords: /\b(test|qa|validate|verify|check\s+quality|coverage|assert)\b/i, type: 'test', agent: 'qa' },
      { keywords: /\b(memor|remember|recall|store|search\s+memory|forget)\b/i, type: 'memory', agent: 'memory' },
      { keywords: /\b(security|vulnerability|audit|threat|injection|xss|sql\s+inject)\b/i, type: 'security', agent: 'security' },
      { keywords: /\b(github|repo|repository|pr|pull\s+request|issue|commit|push|branch)\b/i, type: 'code', agent: 'github' },
      { keywords: /\b(deploy|build|release|ci|cd|publish|docker|kubernetes|infra)\b/i, type: 'deploy', agent: 'deployment' },
    ]

    let bestMatch: { type: TaskAnalysis['type']; agent: string; score: number } | null = null

    for (const pattern of patterns) {
      const matches = task.match(pattern.keywords)
      if (matches) {
        const score = matches.length * 10
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { type: pattern.type, agent: pattern.agent, score }
        }
      }
    }

    const complexity: TaskAnalysis['complexity'] = task.length > 500 ? 'complex' : task.length > 150 ? 'moderate' : 'simple'
    const sensitivity: TaskAnalysis['sensitivity'] =
      /(password|secret|key|credential|token|confidential)/i.test(task) ? 'critical' :
      /(private|internal|sensitive)/i.test(task) ? 'sensitive' : 'normal'

    return {
      type: bestMatch?.type ?? 'code',
      complexity,
      sensitivity,
      targetAgent: bestMatch?.agent ?? 'coder',
      confidence: bestMatch ? Math.min(bestMatch.score / 30, 0.95) : 0.3,
      reasoning: bestMatch ? `Matched keywords for ${bestMatch.agent} with score ${bestMatch.score}` : 'Fallback to coder',
    }
  }

  private async handleComplexGoal(message: AgentMessage, classification: TaskClassificationResult): Promise<AgentMessage> {
    this.logger.info('Complex goal detected, delegating to planner', { traceId: message.metadata.traceId })

    const planRequest = this.createDelegationMessage(message, 'planner', {
      task: message.payload.task,
      context: {
        ...message.payload.context,
        classification,
        goalType: 'complex',
      },
    })

    const planResponse = await this.sendAndWait(planRequest, 'planner')

    if (planResponse.type === 'error') {
      return this.reply(message, { data: { error: 'Planning failed', details: planResponse.payload.data } })
    }

    const workflow = planResponse.payload.data as WorkflowDefinition
    if (!workflow?.steps?.length) {
      return this.reply(message, { data: { error: 'Planner returned empty workflow' } })
    }

    return this.executeWorkflow(message, workflow)
  }

  private async executeWorkflow(message: AgentMessage, workflow: WorkflowDefinition): Promise<AgentMessage> {
    this.logger.info('Executing workflow', { workflowId: workflow.id, steps: workflow.steps.length })

    const completedSteps = new Map<string, unknown>()
    const stepResults: Array<{ stepId: string; result: unknown }> = []

    for (const step of workflow.steps) {
      const dependencies = step.depends_on ?? []
      const unmetDeps = dependencies.filter(d => !completedSteps.has(d))
      if (unmetDeps.length > 0) {
        this.logger.warn('Step dependencies not met, skipping', { stepId: step.id, unmetDeps })
        continue
      }

      let stepInput = step.task
      for (const depId of dependencies) {
        const depResult = completedSteps.get(depId)
        if (depResult) {
          stepInput = stepInput.replace(`{{ ${depId} }}`, JSON.stringify(depResult))
        }
      }

      const stepMessage = this.createDelegationMessage(message, step.agent, {
        task: stepInput,
        context: { workflowId: workflow.id, stepId: step.id },
      })

      const stepResponse = await this.sendAndWait(stepMessage, step.agent)
      completedSteps.set(step.id, stepResponse.payload.data)
      stepResults.push({ stepId: step.id, result: stepResponse.payload.data })
    }

    return this.reply(message, {
      data: {
        workflowId: workflow.id,
        status: 'completed',
        steps: stepResults,
      },
    })
  }

  private requiresScatterGather(task: string, classification: TaskClassificationResult): boolean {
    const taskLower = task.toLowerCase()
    const multiAgentKeywords = /\b(compare|contrast|both|all\s+of|multiple\s+ways|analyze\s+from|gather)\b/i
    return multiAgentKeywords.test(taskLower) && classification.complexity !== 'simple'
  }

  private async handleScatterGather(message: AgentMessage, classification: TaskClassificationResult): Promise<AgentMessage> {
    const targets = this.selectScatterTargets(classification)
    this.logger.info('Scatter-gather to agents', { targets })

    const requests = targets.map(agentId =>
      this.createDelegationMessage(message, agentId, {
        task: message.payload.task,
        context: { ...message.payload.context, scatterGather: true },
      })
    )

    const results = await Promise.allSettled(
      requests.map(req => this.sendAndWait(req, req.to as string))
    )

    const gathered: Array<{ agent: string; result: unknown; status: string }> = results.map((r, i) => ({
      agent: targets[i]!,
      result: r.status === 'fulfilled' ? r.value.payload.data : (r.reason instanceof Error ? r.reason.message : 'Unknown error'),
      status: r.status,
    }))

    return this.reply(message, {
      data: { gathered, scatterGather: true },
    })
  }

  private selectScatterTargets(classification: TaskClassificationResult): string[] {
    const baseTarget = classification.targetAgent
    const allAgents = Object.keys(AGENT_CAPABILITIES).filter(a =>
      a !== 'memory' && a !== 'security'
    )

    if (classification.complexity === 'complex') {
      return allAgents
    }

    const related = [baseTarget]
    if (baseTarget === 'coder') related.push('qa')
    if (baseTarget === 'research') related.push('browser')
    if (baseTarget === 'planner') related.push('coder', 'qa')
    return [...new Set(related)]
  }

  private async delegateToAgent(
    message: AgentMessage,
    targetAgent: string,
    classification?: TaskClassificationResult,
  ): Promise<AgentMessage> {
    this.logger.info('Delegating to agent', { targetAgent, traceId: message.metadata.traceId })

    const delegateMessage = this.createDelegationMessage(message, targetAgent, {
      task: message.payload.task,
      context: {
        ...message.payload.context,
        classification,
        delegatedBy: this.id,
        delegatedAt: new Date().toISOString(),
      },
    })

    const response = await this.sendAndWait(delegateMessage, targetAgent)
    return this.reply(message, { data: response.payload.data })
  }

  private createDelegationMessage(original: AgentMessage, target: string, overrides?: Partial<AgentMessage['payload']>): AgentMessage {
    return {
      id: randomUUID(),
      from: this.id,
      to: target,
      type: 'request',
      priority: original.priority,
      payload: {
        task: original.payload.task,
        context: original.payload.context,
        ...overrides,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        ttl: this.config.limits.timeout,
        traceId: original.metadata.traceId,
        parentId: original.id,
        correlationId: original.metadata.correlationId ?? randomUUID(),
      },
    }
  }

  private async sendAndWait(message: AgentMessage, targetAgent: string): Promise<AgentMessage> {
    return new Promise<AgentMessage>((resolve, reject) => {
      const timeoutMs = this.config.limits.timeout
      const taskId = message.id

      const timeout = setTimeout(() => {
        this.pendingTasks.delete(taskId)
        reject(new AgentError(`Coordinator: agent "${targetAgent}" timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.pendingTasks.set(taskId, { message, startedAt: Date.now(), timeout })

      const unsub = this.eventBus.subscribe(`agent.${targetAgent}.*`, (event) => {
        const payload = event.payload as { taskId?: string }
        if (payload?.taskId === taskId || event.topic === `agent.${targetAgent}.response`) {
          clearTimeout(timeout)
          this.pendingTasks.delete(taskId)
          unsub()

          const response: AgentMessage = {
            id: randomUUID(),
            from: targetAgent,
            to: this.id,
            type: 'response',
            priority: message.priority,
            payload: { data: event.payload },
            metadata: {
              timestamp: new Date().toISOString(),
              ttl: 30000,
              traceId: message.metadata.traceId,
              parentId: message.id,
              correlationId: message.metadata.correlationId,
            },
          }
          resolve(response)
        }
      })

      this.eventBus.publish(
        `agent.${targetAgent}.request`,
        this.id,
        { taskId: message.id, message },
        message.metadata.correlationId,
      )
    })
  }
}
