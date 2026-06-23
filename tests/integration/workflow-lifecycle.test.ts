import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { WorkflowParser } from '../../backend/src/scheduler/workflow-parser.js'
import { WorkflowExecutor } from '../../backend/src/scheduler/workflow-executor.js'
import { MessageDispatcher } from '../../backend/src/router/dispatcher.js'
import { randomUUID } from 'node:crypto'

interface WorkflowStep {
  id: string
  agent: string
  task: string
  depends_on?: string[]
  parallel?: boolean
  gates?: Array<{
    type: 'condition' | 'human_approval'
    expression?: string
    message?: string
  }>
}

interface WorkflowDefinition {
  id: string
  name: string
  steps: WorkflowStep[]
  maxRetries: number
  onFailure: 'abort' | 'skip' | 'notify_human'
}

function createMessage(from: string, to: string | string[], payload: Record<string, unknown>) {
  return {
    id: randomUUID(),
    from,
    to,
    type: 'request' as const,
    priority: 'medium' as const,
    payload,
    metadata: {
      timestamp: new Date().toISOString(),
      ttl: 30000,
      traceId: randomUUID(),
      correlationId: randomUUID(),
    },
  }
}

function makeDef(steps: WorkflowStep[], overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: randomUUID(),
    name: 'integration-test-workflow',
    steps,
    maxRetries: 1,
    onFailure: 'abort',
    ...overrides,
  }
}

describe('Workflow Lifecycle Integration', () => {
  let parser: WorkflowParser
  let dispatcher: MessageDispatcher
  let executor: WorkflowExecutor

  const agentHandlers = new Map<string, (msg: Record<string, unknown>) => Promise<Record<string, unknown>>>()

  beforeEach(() => {
    parser = new WorkflowParser()
    dispatcher = new MessageDispatcher()
    executor = new WorkflowExecutor(parser, dispatcher)
    agentHandlers.clear()

    dispatcher.setAgentLookup((id) => {
      const handler = agentHandlers.get(id)
      if (!handler) return undefined
      return {
        id,
        handleMessage: async (msg) => {
          const result = await handler(msg as never)
          return result as never
        },
      }
    })
  })

  function registerAgent(id: string, handler: (msg: Record<string, unknown>) => Promise<Record<string, unknown>>): void {
    agentHandlers.set(id, handler)
  }

  describe('end-to-end workflow execution', () => {
    it('executes a complete sequential workflow', async () => {
      const executionLog: string[] = []

      registerAgent('init', async (msg) => {
        executionLog.push('init')
        return createMessage('init', msg.to as string, { data: 'initialized' })
      })

      registerAgent('process', async (msg) => {
        executionLog.push('process')
        return createMessage('process', msg.to as string, { data: 'processed' })
      })

      registerAgent('finalize', async (msg) => {
        executionLog.push('finalize')
        return createMessage('finalize', msg.to as string, { data: 'finalized' })
      })

      const steps: WorkflowStep[] = [
        { id: 'step-1', agent: 'init', task: 'initialize' },
        { id: 'step-2', agent: 'process', task: 'process data', depends_on: ['step-1'] },
        { id: 'step-3', agent: 'finalize', task: 'finalize', depends_on: ['step-2'] },
      ]

      const execution = await executor.execute(makeDef(steps))
      expect(execution.state).toBe('completed')
      expect(executionLog).toEqual(['init', 'process', 'finalize'])
    })

    it('executes parallel branches', async () => {
      const parallelExecLog: string[] = []

      registerAgent('start', async (msg) => {
        parallelExecLog.push('start')
        return createMessage('start', msg.to as string, { data: 'started' })
      })

      registerAgent('branch-a', async (msg) => {
        parallelExecLog.push('branch-a')
        return createMessage('branch-a', msg.to as string, { data: 'a' })
      })

      registerAgent('branch-b', async (msg) => {
        parallelExecLog.push('branch-b')
        return createMessage('branch-b', msg.to as string, { data: 'b' })
      })

      registerAgent('merge', async (msg) => {
        parallelExecLog.push('merge')
        return createMessage('merge', msg.to as string, { data: 'merged' })
      })

      const steps: WorkflowStep[] = [
        { id: 'start', agent: 'start', task: 'begin' },
        { id: 'branch-a', agent: 'branch-a', task: 'do-a', depends_on: ['start'] },
        { id: 'branch-b', agent: 'branch-b', task: 'do-b', depends_on: ['start'] },
        { id: 'merge', agent: 'merge', task: 'combine', depends_on: ['branch-a', 'branch-b'] },
      ]

      const execution = await executor.execute(makeDef(steps))
      expect(execution.state).toBe('completed')
      expect(parallelExecLog).toContain('start')
      expect(parallelExecLog).toContain('branch-a')
      expect(parallelExecLog).toContain('branch-b')
      expect(parallelExecLog).toContain('merge')
    })
  })

  describe('gate handling', () => {
    it('executes steps with condition gates (no actual blocking)', async () => {
      registerAgent('gated', async (msg) => {
        return createMessage('gated', msg.to as string, { data: 'passed gate' })
      })

      const steps: WorkflowStep[] = [
        {
          id: 'gated-step',
          agent: 'gated',
          task: 'do something',
          gates: [{ type: 'condition', expression: 'input.valid == true' }],
        },
      ]

      const execution = await executor.execute(makeDef(steps))
      expect(execution.state).toBe('completed')
      const stepExec = execution.steps.get('gated-step')
      expect(stepExec?.state).toBe('completed')
    })
  })

  describe('step failure and cascading', () => {
    it('logs delivery errors but completes workflow', async () => {
      registerAgent('good', async (msg) => {
        return createMessage('good', msg.to as string, { data: 'ok' })
      })

      registerAgent('bad', async (_msg) => {
        throw new Error('critical failure')
      })

      const steps: WorkflowStep[] = [
        { id: 'setup', agent: 'good', task: 'setup' },
        { id: 'fails', agent: 'bad', task: 'will-fail', depends_on: ['setup'] },
      ]

      const execution = await executor.execute(makeDef(steps))
      expect(execution.state).toBe('completed')
    })

    it('handles step with throwing agent gracefully', async () => {
      registerAgent('failing', async (_msg) => {
        throw new Error('non-critical failure')
      })

      const steps: WorkflowStep[] = [
        { id: 'failing-step', agent: 'failing', task: 'might-fail' },
      ]

      const execution = await executor.execute(makeDef(steps, { onFailure: 'skip', maxRetries: 0 }))
      expect(execution.state).toBe('completed')
    })
  })

  describe('workflow with multiple branching levels', () => {
    it('handles diamond-shaped dependency graph', async () => {
      const order: string[] = []

      registerAgent('root', async (msg) => {
        order.push('root')
        return createMessage('root', msg.to as string, {})
      })
      registerAgent('left', async (msg) => {
        order.push('left')
        return createMessage('left', msg.to as string, {})
      })
      registerAgent('right', async (msg) => {
        order.push('right')
        return createMessage('right', msg.to as string, {})
      })
      registerAgent('leaf', async (msg) => {
        order.push('leaf')
        return createMessage('leaf', msg.to as string, {})
      })

      const steps: WorkflowStep[] = [
        { id: 'root', agent: 'root', task: 'start' },
        { id: 'left', agent: 'left', task: 'left-branch', depends_on: ['root'] },
        { id: 'right', agent: 'right', task: 'right-branch', depends_on: ['root'] },
        { id: 'leaf', agent: 'leaf', task: 'end', depends_on: ['left', 'right'] },
      ]

      const execution = await executor.execute(makeDef(steps))
      expect(execution.state).toBe('completed')
      expect(order).toContain('root')
      expect(order).toContain('left')
      expect(order).toContain('right')
      expect(order).toContain('leaf')
    })
  })
})
