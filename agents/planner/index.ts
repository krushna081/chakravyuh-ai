import { BaseAgent } from '../base'
import type { AgentMessage, WorkflowDefinition, WorkflowStep, WorkflowGate, TaskAnalysis } from '@chakravyuh/core'
import { randomUUID } from 'node:crypto'

interface DecompositionResult {
  workflow: WorkflowDefinition
  rationale: string
  alternatives?: string[]
}

export class PlannerAgent extends BaseAgent {
  private workflowHistory = new Map<string, WorkflowDefinition>()
  private planCache = new Map<string, DecompositionResult>()

  async onStart(): Promise<void> {
    this.logger.info('Planner agent ready for goal decomposition')
  }

  async onMessage(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const context = message.payload.context ?? {}
    const classification = context.classification as TaskAnalysis | undefined

    if (!task) {
      return this.reply(message, { data: { error: 'No task provided for planning' } })
    }

    if (classification?.type === 'plan' || await this.isPlanningRequest(task)) {
      const plan = await this.createWorkflowPlan(task, context)
      return this.reply(message, { data: plan })
    }

    const subWorkflows = await this.decomposeGoal(task, context)
    const merged = this.mergeSubWorkflows(subWorkflows, task)
    return this.reply(message, { data: merged })
  }

  async onError(error: Error, message: AgentMessage): Promise<void> {
    this.logger.error('Planner error', { error: error.message, taskId: message.id })
    await this.storeProcedural(`Planning error for task ${message.id}: ${error.message}`, {
      taskId: message.id,
      error: error.message,
    })
  }

  private async isPlanningRequest(task: string): Promise<boolean> {
    const planIndicators = [
      /^(create|design|make|build)\s+a\s+plan/i,
      /^(plan|workflow|pipeline|steps)\b/i,
      /how\s+(would|should|can)\s+(i|we)\s+(implement|build|create|deploy)/i,
      /what\s+(are\s+the\s+)?steps/i,
    ]
    return planIndicators.some(p => p.test(task))
  }

  private async createWorkflowPlan(task: string, context: Record<string, unknown>): Promise<WorkflowDefinition> {
    const cacheKey = this.cacheKey(task, context)
    const cached = this.planCache.get(cacheKey)
    if (cached) return cached.workflow

    const steps = await this.generateSteps(task, context)
    const workflow: WorkflowDefinition = {
      id: `wf-${randomUUID().slice(0, 8)}`,
      version: '1.0',
      description: task.length > 100 ? task.slice(0, 100) + '...' : task,
      maxRetries: 3,
      onFailure: task.includes('critical') || task.includes('production') ? 'notify_human' : 'abort',
      steps,
    }

    const result: DecompositionResult = {
      workflow,
      rationale: `Decomposed into ${steps.length} steps with dependencies`,
    }

    this.planCache.set(cacheKey, result)
    this.workflowHistory.set(workflow.id, workflow)

    await this.storeProcedural(JSON.stringify(workflow, null, 2), {
      type: 'workflow_plan',
      workflowId: workflow.id,
      taskPreview: task.slice(0, 200),
    })

    return workflow
  }

  private async decomposeGoal(task: string, context: Record<string, unknown>): Promise<WorkflowDefinition[]> {
    const subGoals = await this.extractSubGoals(task, context)
    const workflows: WorkflowDefinition[] = []

    for (const subGoal of subGoals) {
      const wf = await this.createWorkflowPlan(subGoal, context)
      workflows.push(wf)
    }

    return workflows
  }

  private mergeSubWorkflows(workflows: WorkflowDefinition[], originalTask: string): WorkflowDefinition {
    const allSteps: WorkflowStep[] = []
    let previousId: string | undefined

    for (const wf of workflows) {
      for (const step of wf.steps) {
        const mergedStep: WorkflowStep = {
          ...step,
          depends_on: previousId ? [previousId, ...(step.depends_on ?? [])] : step.depends_on,
        }
        allSteps.push(mergedStep)
        previousId = step.id
      }
    }

    return {
      id: `wf-merged-${randomUUID().slice(0, 8)}`,
      version: '1.0',
      description: originalTask.slice(0, 100),
      maxRetries: 2,
      onFailure: 'abort',
      steps: allSteps,
    }
  }

  private async generateSteps(task: string, context: Record<string, unknown>): Promise<WorkflowStep[]> {
    const steps: WorkflowStep[] = []
    const taskLower = task.toLowerCase()

    const hasCode = /\b(code|implement|write|refactor|build|create\s+app|add\s+(feature|function))\b/i.test(task)
    const hasResearch = /\b(research|search|find|look\s+up|investigate)\b/i.test(task)
    const hasTest = /\b(test|validate|verify|qa)\b/i.test(task)
    const hasSecurity = /\b(security|vulnerability|audit)\b/i.test(task)
    const hasDeploy = /\b(deploy|release|publish|ship)\b/i.test(task)
    const hasGitHub = /\b(github|pr|pull\s+request|repo|repository)\b/i.test(task)
    const hasBrowse = /\b(browse|scrape|screenshot|crawl)\b/i.test(task)

    if (hasResearch) {
      steps.push(this.createStep('research', 'Researcher', task, 'gather-information'))
    }

    if (hasBrowse) {
      steps.push(this.createStep('browse', 'Browser', task, 'browse-web', hasResearch ? ['gather-information'] : undefined))
    }

    if (hasCode) {
      const codeStep = this.createStep('code', 'Coder', task, 'implement-code',
        hasResearch ? ['gather-information'] : undefined)
      codeStep.gates = this.determineGates(task, 'code')
      steps.push(codeStep)
    }

    if (hasSecurity) {
      const securityStep = this.createStep('security', 'Security', task, 'audit-code',
        hasCode ? ['implement-code'] : undefined)
      steps.push(securityStep)
    }

    if (hasTest) {
      const testStep = this.createStep('test', 'QA', task, 'run-tests',
        hasCode ? ['implement-code'] : undefined)
      testStep.gates = [{ type: 'condition', expression: 'steps.code.status == "completed"' }]
      steps.push(testStep)
    }

    if (hasGitHub) {
      steps.push(this.createStep('github', 'GitHub', task, 'manage-repo',
        hasCode ? ['implement-code'] : undefined))
    }

    if (hasDeploy) {
      const deployStep = this.createStep('deploy', 'Deployment', task, 'deploy',
        hasCode ? ['implement-code'] : undefined)
      deployStep.gates = [{ type: 'human_approval', message: 'Approve deployment?' }]
      steps.push(deployStep)
    }

    if (steps.length === 0) {
      steps.push(this.createStep('analyze', 'Coder', `Analyze: ${task}`, 'analyze'))
    }

    return steps
  }

  private createStep(
    id: string,
    agent: string,
    task: string,
    outputKey: string,
    dependsOn?: string[],
  ): WorkflowStep {
    return {
      id,
      agent: agent.toLowerCase(),
      task,
      depends_on: dependsOn,
      parallel: false,
      output: outputKey,
    }
  }

  private determineGates(task: string, stepType: string): WorkflowGate[] | undefined {
    const gates: WorkflowGate[] = []

    if (stepType === 'code' && /(critical|production|breaking)/i.test(task)) {
      gates.push({
        type: 'human_approval',
        message: 'Review generated code before proceeding?',
      })
    }

    if (stepType === 'code' && /(delete|remove|destroy|migrate)/i.test(task)) {
      gates.push({
        type: 'human_approval',
        message: 'This step involves destructive changes. Approve?',
      })
    }

    return gates.length > 0 ? gates : undefined
  }

  private async extractSubGoals(task: string, context: Record<string, unknown>): Promise<string[]> {
    const subGoals: string[] = []
    const taskLower = task.toLowerCase()

    if (taskLower.includes('and') || taskLower.includes(',')) {
      const parts = task.split(/\band\b|,/)
        .map(p => p.trim())
        .filter(p => p.length > 10)

      if (parts.length > 1) {
        return parts.slice(0, 5)
      }
    }

    if (/(full\s+)?(stack|end.to.end|complete)/i.test(task)) {
      subGoals.push(`Research requirements for: ${task}`)
      subGoals.push(`Design architecture for: ${task}`)
      subGoals.push(`Implement: ${task}`)
      subGoals.push(`Test: ${task}`)
    }

    if (subGoals.length === 0) {
      subGoals.push(task)
    }

    return subGoals
  }

  private cacheKey(task: string, context: Record<string, unknown>): string {
    const contextKey = Object.keys(context).sort().map(k => `${k}=${JSON.stringify(context[k])}`).join('&')
    return `${task}|${contextKey}`
  }
}
