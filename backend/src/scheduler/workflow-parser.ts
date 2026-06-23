import { randomUUID } from 'node:crypto'
import { ValidationError } from '../errors.js'
import { logger } from '../logger.js'
import type { WorkflowDefinition, WorkflowStep } from '../types.js'

export interface ParsedWorkflow {
  definition: WorkflowDefinition
  dag: Map<string, string[]>
  reverseDag: Map<string, string[]>
  levels: string[][]
  parallelGroups: Map<string, string[]>
  entryPoints: string[]
  leafNodes: string[]
}

export class WorkflowParser {
  parse(definition: WorkflowDefinition): ParsedWorkflow {
    if (!definition.id) {
      definition.id = randomUUID()
    }

    if (!definition.steps || definition.steps.length === 0) {
      throw new ValidationError('Workflow must have at least one step')
    }

    this.validateStepIds(definition.steps)
    this.validateDependencies(definition.steps)
    this.detectCircularDependencies(definition.steps)
    this.validateGates(definition.steps)

    const dag = this.buildDAG(definition.steps)
    const reverseDag = this.buildReverseDAG(definition.steps)
    const levels = this.topologicalSort(definition.steps, dag)
    const parallelGroups = this.buildParallelGroups(definition.steps)
    const entryPoints = this.findEntryPoints(definition.steps, dag)
    const leafNodes = this.findLeafNodes(dag)

    return {
      definition,
      dag,
      reverseDag,
      levels,
      parallelGroups,
      entryPoints,
      leafNodes,
    }
  }

  private validateStepIds(steps: WorkflowStep[]): void {
    const ids = new Set<string>()
    for (const step of steps) {
      if (!step.id) {
        throw new ValidationError('Each workflow step must have an id')
      }
      if (step.id.trim() === '') {
        throw new ValidationError('Step id cannot be empty')
      }
      if (ids.has(step.id)) {
        throw new ValidationError(`Duplicate step id: ${step.id}`)
      }
      ids.add(step.id)
    }
  }

  private validateDependencies(steps: WorkflowStep[]): void {
    const validIds = new Set(steps.map((s) => s.id))
    for (const step of steps) {
      if (step.depends_on) {
        for (const dep of step.depends_on) {
          if (!validIds.has(dep)) {
            throw new ValidationError(
              `Step "${step.id}" depends on unknown step "${dep}"`,
            )
          }
          if (dep === step.id) {
            throw new ValidationError(
              `Step "${step.id}" cannot depend on itself`,
            )
          }
        }
      }
    }
  }

  private detectCircularDependencies(steps: WorkflowStep[]): void {
    const adjacency = new Map<string, string[]>()
    for (const step of steps) {
      adjacency.set(step.id, step.depends_on ?? [])
    }

    const visited = new Set<string>()
    const recStack = new Set<string>()

    const dfs = (node: string): boolean => {
      if (recStack.has(node)) return true
      if (visited.has(node)) return false

      visited.add(node)
      recStack.add(node)

      const deps = adjacency.get(node) ?? []
      for (const dep of deps) {
        if (dfs(dep)) return true
      }

      recStack.delete(node)
      return false
    }

    for (const step of steps) {
      if (dfs(step.id)) {
        throw new ValidationError(
          `Circular dependency detected involving step "${step.id}"`,
        )
      }
    }
  }

  private validateGates(steps: WorkflowStep[]): void {
    for (const step of steps) {
      if (step.gates) {
        for (const gate of step.gates) {
          if (gate.type === 'condition' && !gate.expression) {
            throw new ValidationError(
              `Conditional gate on step "${step.id}" must have an expression`,
            )
          }
          if (gate.type === 'human_approval' && !gate.message) {
            throw new ValidationError(
              `Human approval gate on step "${step.id}" must have a message`,
            )
          }
        }
      }
    }
  }

  private buildDAG(steps: WorkflowStep[]): Map<string, string[]> {
    const dag = new Map<string, string[]>()
    for (const step of steps) {
      dag.set(step.id, step.depends_on ?? [])
    }
    return dag
  }

  private buildReverseDAG(steps: WorkflowStep[]): Map<string, string[]> {
    const reverse = new Map<string, string[]>()
    for (const step of steps) {
      reverse.set(step.id, [])
    }
    for (const step of steps) {
      for (const dep of step.depends_on ?? []) {
        const list = reverse.get(dep) ?? []
        list.push(step.id)
        reverse.set(dep, list)
      }
    }
    return reverse
  }

  private topologicalSort(steps: WorkflowStep[], dag: Map<string, string[]>): string[][] {
    const inDegree = new Map<string, number>()
    const stepMap = new Map(steps.map((s) => [s.id, s]))

    for (const step of steps) {
      inDegree.set(step.id, (step.depends_on ?? []).length)
    }

    const levels: string[][] = []
    let queue: string[] = []

    for (const step of steps) {
      if (inDegree.get(step.id) === 0) {
        queue.push(step.id)
      }
    }

    while (queue.length > 0) {
      levels.push([...queue])
      const nextQueue: string[] = []

      for (const nodeId of queue) {
        const step = stepMap.get(nodeId)!
        if (step.parallel) continue

        for (const [otherId, deps] of dag) {
          if (deps.includes(nodeId)) {
            const newDegree = (inDegree.get(otherId) ?? 1) - 1
            inDegree.set(otherId, newDegree)
            if (newDegree === 0) {
              nextQueue.push(otherId)
            }
          }
        }
      }

      queue = nextQueue
    }

    return levels
  }

  private buildParallelGroups(steps: WorkflowStep[]): Map<string, string[]> {
    const groups = new Map<string, string[]>()

    for (const step of steps) {
      if (!step.parallel) continue

      const depsKey = (step.depends_on ?? []).sort().join(',')
      const existing = groups.get(depsKey) ?? []
      existing.push(step.id)
      groups.set(depsKey, existing)
    }

    return groups
  }

  private findEntryPoints(steps: WorkflowStep[], dag: Map<string, string[]>): string[] {
    return steps
      .filter((s) => !s.depends_on || s.depends_on.length === 0)
      .map((s) => s.id)
  }

  private findLeafNodes(dag: Map<string, string[]>): string[] {
    const hasDependents = new Set<string>()
    for (const [, deps] of dag) {
      for (const dep of deps) {
        hasDependents.add(dep)
      }
    }

    const leaves: string[] = []
    for (const nodeId of dag.keys()) {
      if (!hasDependents.has(nodeId)) {
        leaves.push(nodeId)
      }
    }

    return leaves
  }

  getExecutionOrder(parsed: ParsedWorkflow): string[] {
    const order: string[] = []
    const added = new Set<string>()

    for (const level of parsed.levels) {
      for (const nodeId of level) {
        if (!added.has(nodeId)) {
          order.push(nodeId)
          added.add(nodeId)
        }
      }
    }

    return order
  }
}
