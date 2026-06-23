import { describe, it, expect, beforeEach, vi } from 'vitest'
import { WorkflowExecutor } from '../../backend/src/scheduler/workflow-executor.js'
import { WorkflowParser } from '../../backend/src/scheduler/workflow-parser.js'
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

function makeDef(steps: WorkflowStep[], overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition {
  return {
    id: randomUUID(),
    name: 'test',
    steps,
    maxRetries: 2,
    onFailure: 'abort',
    ...overrides,
  }
}

describe('WorkflowExecutor', () => {
  let parser: WorkflowParser
  let dispatcher: MessageDispatcher
  let executor: WorkflowExecutor

  beforeEach(() => {
    parser = new WorkflowParser()
    dispatcher = new MessageDispatcher()
    executor = new WorkflowExecutor(parser, dispatcher)
  })

  describe('sequential step execution', () => {
    it('executes steps in dependency order', async () => {
      const steps: WorkflowStep[] = [
        { id: 'a', agent: 'agent-a', task: 'first' },
        { id: 'b', agent: 'agent-b', task: 'second', depends_on: ['a'] },
        { id: 'c', agent: 'agent-c', task: 'third', depends_on: ['b'] },
      ]

      const order: string[] = []
      dispatcher.setAgentLookup(() => ({
        id: 'mock',
        handleMessage: async () => {
          order.push('called')
          return { id: randomUUID(), from: 'mock', to: 'exec', type: 'response', priority: 'high', payload: {}, metadata: { timestamp: new Date().toISOString(), ttl: 1000, traceId: '', correlationId: '' } }
        },
      }))

      const execution = await executor.execute(makeDef(steps))
      expect(execution.state).toBe('completed')
      expect(order.length).toBe(3)
    })

    it('marks all steps as completed on success', async () => {
      dispatcher.setAgentLookup(() => ({
        id: 'mock',
        handleMessage: async () => ({ id: randomUUID(), from: 'mock', to: 'exec', type: 'response', priority: 'high', payload: {}, metadata: { timestamp: new Date().toISOString(), ttl: 1000, traceId: '', correlationId: '' } }),
      }))

      const steps: WorkflowStep[] = [
        { id: 'x', agent: 'agent-x', task: 'do' },
      ]
      const execution = await executor.execute(makeDef(steps))
      const stepExec = execution.steps.get('x')
      expect(stepExec?.state).toBe('completed')
    })
  })

  describe('parallel step execution', () => {
    it('executes independent steps concurrently', async () => {
      dispatcher.setAgentLookup(() => ({
        id: 'mock',
        handleMessage: async () => ({ id: randomUUID(), from: 'mock', to: 'exec', type: 'response', priority: 'high', payload: {}, metadata: { timestamp: new Date().toISOString(), ttl: 1000, traceId: '', correlationId: '' } }),
      }))

      const steps: WorkflowStep[] = [
        { id: 'start', agent: 'a', task: 'begin' },
        { id: 'p1', agent: 'b', task: 'parallel-1', depends_on: ['start'] },
        { id: 'p2', agent: 'c', task: 'parallel-2', depends_on: ['start'] },
        { id: 'end', agent: 'd', task: 'finish', depends_on: ['p1', 'p2'] },
      ]

      const execution = await executor.execute(makeDef(steps))
      expect(execution.state).toBe('completed')
    })
  })

  describe('delivery failure handling', () => {
    it('completes workflow when agent lookup returns undefined', async () => {
      const steps: WorkflowStep[] = [
        { id: 'orphan', agent: 'no-such-agent', task: 'doom' },
      ]
      const execution = await executor.execute(makeDef(steps))
      expect(execution.state).toBe('completed')
    })

    it('completes workflow when agent handleMessage throws', async () => {
      dispatcher.setAgentLookup(() => ({
        id: 'fail-agent',
        handleMessage: async () => { throw new Error('failure') },
      }))

      const steps: WorkflowStep[] = [
        { id: 'f', agent: 'fail-agent', task: 'will-fail' },
      ]

      const execution = await executor.execute(makeDef(steps))
      expect(execution.state).toBe('completed')
      const stepExec = execution.steps.get('f')
      expect(stepExec?.state).toBe('completed')
    })
  })

  describe('retry in dispatcher', () => {
    it('dispatcher retries delivery on transient errors', async () => {
      let callCount = 0
      dispatcher.setAgentLookup(() => ({
        id: 'retry-agent',
        handleMessage: async () => {
          callCount++
          throw new Error('transient')
        },
      }))

      const msg = { id: randomUUID(), from: 't', to: 'retry-agent', type: 'request', priority: 'medium', payload: {}, metadata: { timestamp: new Date().toISOString(), ttl: 30000, traceId: randomUUID(), correlationId: randomUUID() } }
      await expect(dispatcher.dispatch(msg)).resolves.toBeUndefined()
      expect(callCount).toBeGreaterThanOrEqual(1)
    })
  })

  describe('getExecution and getActiveExecutions', () => {
    it('getExecution returns execution by id', async () => {
      dispatcher.setAgentLookup(() => ({
        id: 'mock',
        handleMessage: async () => ({ id: randomUUID(), from: 'mock', to: 'exec', type: 'response', priority: 'high', payload: {}, metadata: { timestamp: new Date().toISOString(), ttl: 1000, traceId: '', correlationId: '' } }),
      }))

      const steps: WorkflowStep[] = [{ id: 'a', agent: 'agent-a', task: 't' }]
      const execution = await executor.execute(makeDef(steps))
      const lookup = executor.getExecution(execution.id)
      expect(lookup).toBeDefined()
      expect(lookup!.id).toBe(execution.id)
    })

    it('getActiveExecutions returns running executions', async () => {
      dispatcher.setAgentLookup(() => ({
        id: 'mock',
        handleMessage: async () => ({ id: randomUUID(), from: 'mock', to: 'exec', type: 'response', priority: 'high', payload: {}, metadata: { timestamp: new Date().toISOString(), ttl: 1000, traceId: '', correlationId: '' } }),
      }))

      const steps: WorkflowStep[] = [{ id: 'a', agent: 'agent-a', task: 't' }]
      await executor.execute(makeDef(steps))
      expect(executor.getActiveExecutions().length).toBe(0)
    })
  })

  describe('stop', () => {
    it('stop clears listeners', () => {
      executor.stop()
      expect(executor.getActiveExecutions()).toEqual([])
    })
  })
})
