import { describe, it, expect, beforeEach } from 'vitest'
import { WorkflowParser } from '../../backend/src/scheduler/workflow-parser.js'
import { ValidationError } from '../../backend/src/errors.js'
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

function validDef(overrides: Partial<WorkflowDefinition> = {}, steps?: WorkflowStep[]): WorkflowDefinition {
  return {
    id: randomUUID(),
    name: 'test-workflow',
    steps: steps ?? [
      { id: 'step-1', agent: 'agent-a', task: 'do thing' },
      { id: 'step-2', agent: 'agent-b', task: 'do other', depends_on: ['step-1'] },
    ],
    maxRetries: 2,
    onFailure: 'abort',
    ...overrides,
  }
}

describe('WorkflowParser', () => {
  let parser: WorkflowParser

  beforeEach(() => {
    parser = new WorkflowParser()
  })

  describe('valid workflow parsing', () => {
    it('parses a simple sequential workflow', () => {
      const def = validDef()
      const parsed = parser.parse(def)
      expect(parsed.definition.id).toBe(def.id)
      expect(parsed.dag.size).toBe(2)
      expect(parsed.levels.length).toBeGreaterThanOrEqual(1)
      expect(parsed.entryPoints).toContain('step-1')
      expect(parsed.leafNodes).toContain('step-2')
    })

    it('assigns a random id if missing', () => {
      const def = validDef({ id: '' as unknown as string })
      const parsed = parser.parse({ ...def, id: '' } as unknown as WorkflowDefinition)
      expect(parsed.definition.id).toBeTruthy()
    })

    it('parses parallel steps correctly', () => {
      const steps: WorkflowStep[] = [
        { id: 'start', agent: 'a', task: 'init' },
        { id: 'p1', agent: 'b', task: 'parallel-1', depends_on: ['start'], parallel: true },
        { id: 'p2', agent: 'c', task: 'parallel-2', depends_on: ['start'], parallel: true },
        { id: 'end', agent: 'd', task: 'merge', depends_on: ['p1', 'p2'] },
      ]
      const def = validDef({}, steps)
      const parsed = parser.parse(def)
      expect(parsed.entryPoints).toEqual(['start'])
      expect(parsed.leafNodes).toContain('end')
      expect(parsed.levels.length).toBeGreaterThanOrEqual(2)
    })

    it('dereference detects the reverse DAG correctly', () => {
      const steps: WorkflowStep[] = [
        { id: 'a', agent: 'x', task: 't1' },
        { id: 'b', agent: 'x', task: 't2', depends_on: ['a'] },
        { id: 'c', agent: 'x', task: 't3', depends_on: ['a'] },
      ]
      const parsed = parser.parse(validDef({}, steps))
      expect(parsed.reverseDag.get('a')).toEqual(['b', 'c'])
      expect(parsed.reverseDag.get('b')).toEqual([])
    })
  })

  describe('circular dependency detection', () => {
    it('detects direct self-dependency', () => {
      const steps: WorkflowStep[] = [
        { id: 'a', agent: 'x', task: 't', depends_on: ['a'] },
      ]
      expect(() => parser.parse(validDef({}, steps))).toThrow(ValidationError)
    })

    it('detects circular dependency A -> B -> C -> A', () => {
      const steps: WorkflowStep[] = [
        { id: 'a', agent: 'x', task: 't', depends_on: ['c'] },
        { id: 'b', agent: 'x', task: 't', depends_on: ['a'] },
        { id: 'c', agent: 'x', task: 't', depends_on: ['b'] },
      ]
      expect(() => parser.parse(validDef({}, steps))).toThrow(ValidationError)
    })

    it('detects two-node cycle', () => {
      const steps: WorkflowStep[] = [
        { id: 'x', agent: 'a', task: 't', depends_on: ['y'] },
        { id: 'y', agent: 'b', task: 't', depends_on: ['x'] },
      ]
      expect(() => parser.parse(validDef({}, steps))).toThrow(ValidationError)
    })
  })

  describe('parallel step grouping', () => {
    it('groups steps with same dependencies together', () => {
      const steps: WorkflowStep[] = [
        { id: 'root', agent: 'a', task: 'start' },
        { id: 'pa', agent: 'b', task: 'pa', depends_on: ['root'], parallel: true },
        { id: 'pb', agent: 'c', task: 'pb', depends_on: ['root'], parallel: true },
        { id: 'pc', agent: 'd', task: 'pc', depends_on: ['root'], parallel: true },
      ]
      const parsed = parser.parse(validDef({}, steps))
      expect(parsed.parallelGroups.size).toBeGreaterThan(0)
      const group = Array.from(parsed.parallelGroups.values()).find((g) => g.length === 3)
      expect(group).toBeDefined()
    })

    it('handles no parallel steps', () => {
      const steps: WorkflowStep[] = [
        { id: 'a', agent: 'x', task: 't' },
        { id: 'b', agent: 'x', task: 't', depends_on: ['a'] },
      ]
      const parsed = parser.parse(validDef({}, steps))
      expect(parsed.parallelGroups.size).toBe(0)
    })
  })

  describe('missing step references', () => {
    it('throws when depending on unknown step', () => {
      const steps: WorkflowStep[] = [
        { id: 'a', agent: 'x', task: 't', depends_on: ['ghost'] },
      ]
      expect(() => parser.parse(validDef({}, steps))).toThrow(ValidationError)
    })

    it('throws on duplicate step ids', () => {
      const steps: WorkflowStep[] = [
        { id: 'same', agent: 'a', task: 't' },
        { id: 'same', agent: 'b', task: 't2' },
      ]
      expect(() => parser.parse(validDef({}, steps))).toThrow(ValidationError)
    })

    it('throws on empty step id', () => {
      const steps: WorkflowStep[] = [
        { id: '', agent: 'a', task: 't' },
      ]
      expect(() => parser.parse(validDef({}, steps))).toThrow(ValidationError)
    })

    it('throws on workflow with no steps', () => {
      expect(() => parser.parse(validDef({}, []))).toThrow(ValidationError)
    })
  })

  describe('gate validation', () => {
    it('requires expression for condition gates', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'a', agent: 'x', task: 't',
          gates: [{ type: 'condition', expression: '' as unknown as undefined }],
        },
      ]
      expect(() => parser.parse(validDef({}, steps))).toThrow(ValidationError)
    })

    it('requires message for human_approval gates', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'a', agent: 'x', task: 't',
          gates: [{ type: 'human_approval', message: '' as unknown as undefined }],
        },
      ]
      expect(() => parser.parse(validDef({}, steps))).toThrow(ValidationError)
    })

    it('allows valid gates', () => {
      const steps: WorkflowStep[] = [
        {
          id: 'a', agent: 'x', task: 't',
          gates: [
            { type: 'condition', expression: 'result == true' },
            { type: 'human_approval', message: 'Approve this?' },
          ],
        },
      ]
      const parsed = parser.parse(validDef({}, steps))
      expect(parsed.definition.steps[0].gates).toHaveLength(2)
    })
  })

  describe('getExecutionOrder', () => {
    it('returns steps in topological order', () => {
      const steps: WorkflowStep[] = [
        { id: 'first', agent: 'a', task: 't' },
        { id: 'second', agent: 'b', task: 't', depends_on: ['first'] },
        { id: 'third', agent: 'c', task: 't', depends_on: ['first', 'second'] },
      ]
      const parsed = parser.parse(validDef({}, steps))
      const order = parser.getExecutionOrder(parsed)
      expect(order.indexOf('first')).toBeLessThan(order.indexOf('second'))
      expect(order.indexOf('second')).toBeLessThan(order.indexOf('third'))
    })
  })
})
