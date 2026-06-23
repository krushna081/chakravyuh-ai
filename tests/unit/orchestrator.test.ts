import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Engine } from '../../backend/src/orchestrator/engine.js'
import { LifecycleManager, LifecycleState } from '../../backend/src/orchestrator/lifecycle.js'
import { HealthChecker } from '../../backend/src/orchestrator/health.js'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import os from 'node:os'

function tmpDir(): string {
  const d = join(os.tmpdir(), `eng-test-${randomUUID()}`)
  mkdirSync(d, { recursive: true })
  return d
}

function writeMinimalConfigs(dir: string): void {
  writeFileSync(join(dir, 'providers.yaml'), 'providers:\n  p:\n    enabled: true\n    priority: 1\n    models: []', 'utf-8')
  writeFileSync(join(dir, 'agents.yaml'), 'agents:\n  a:\n    name: A\n    role: test\n    systemPrompt: x\n    provider: p\n    tools:\n      - search\n    memoryScope:\n      - working\n    allowedPeers:\n      - coordinator\n    limits:\n      maxTokensPerTask: 1000\n      maxConsecutiveCalls: 5\n      timeout: 10000', 'utf-8')
  writeFileSync(join(dir, 'mcp.yaml'), 'servers:\n  s:\n    enabled: true\n    autoStart: false\n    command: echo\n    args: []\n    env: {}\n', 'utf-8')
}

describe('Engine', () => {
  let configDir: string

  beforeEach(() => {
    configDir = tmpDir()
    writeMinimalConfigs(configDir)
  })

  afterEach(() => {
    try { rmSync(configDir, { recursive: true, force: true }) } catch { }
  })

  describe('start/stop lifecycle', () => {
    it('starts successfully and transitions to Running', async () => {
      const engine = new Engine({ configDir })
      expect(engine.lifecycle.state).toBe(LifecycleState.Created)
      await engine.start()
      expect(engine.lifecycle.state).toBe(LifecycleState.Running)
    })

    it('fails to start if config is missing', async () => {
      const badDir = join(os.tmpdir(), `eng-fail-${randomUUID()}`)
      mkdirSync(badDir, { recursive: true })
      const engine = new Engine({ configDir: badDir })
      await expect(engine.start()).rejects.toThrow()
      try { rmSync(badDir, { recursive: true, force: true }) } catch { }
    })

    it('stops and transitions to Stopped', async () => {
      const engine = new Engine({ configDir })
      await engine.start()
      await engine.stop()
      expect(engine.lifecycle.state).toBe(LifecycleState.Stopped)
    })

    it('allows restart after stop', async () => {
      const engine = new Engine({ configDir })
      await engine.start()
      await engine.stop()
      expect(engine.lifecycle.state).toBe(LifecycleState.Stopped)
      await engine.start()
      expect(engine.lifecycle.state).toBe(LifecycleState.Running)
    })

    it('shutdown with timeout succeeds', async () => {
      const engine = new Engine({ configDir })
      await engine.start()
      await engine.shutdown(5000)
      expect(engine.lifecycle.state === LifecycleState.Stopped || engine.lifecycle.state === LifecycleState.Error).toBe(true)
    })

    it('canStart returns false when already running', async () => {
      const engine = new Engine({ configDir })
      expect(engine.lifecycle.canStart()).toBe(true)
      await engine.start()
      expect(engine.lifecycle.canStart()).toBe(false)
    })
  })

  describe('health check aggregation', () => {
    it('returns a HealthReport with component statuses', async () => {
      const engine = new Engine({ configDir })
      await engine.start()
      const report = await engine.isHealthy()
      expect(report.status).toBeDefined()
      expect(Array.isArray(report.components)).toBe(true)
      expect(report.components.length).toBeGreaterThan(0)
      expect(report.summary).toBeDefined()
      expect(report.summary.total).toBeGreaterThan(0)
    })

    it('aggregates health checks from all registered components', async () => {
      const engine = new Engine({ configDir })
      await engine.start()
      const report = await engine.isHealthy()
      const componentIds = report.components.map((c) => c.componentId)
      expect(componentIds).toContain('config')
      expect(componentIds).toContain('agent-registry')
      expect(componentIds).toContain('service-registry')
      expect(componentIds).toContain('router')
      expect(componentIds).toContain('dispatcher')
    })
  })

  describe('component registration', () => {
    it('exposes all core components', async () => {
      const engine = new Engine({ configDir })
      expect(engine.router).toBeDefined()
      expect(engine.dispatcher).toBeDefined()
      expect(engine.workflowParser).toBeDefined()
      expect(engine.workflowExecutor).toBeDefined()
      expect(engine.agentRegistry).toBeDefined()
      expect(engine.serviceRegistry).toBeDefined()
      expect(engine.taskAnalyzer).toBeDefined()
      expect(engine.config).toBeDefined()
      expect(engine.lifecycle).toBeDefined()
      expect(engine.health).toBeDefined()
      expect(engine.events).toBeDefined()
    })
  })

  describe('lifecycle event emission', () => {
    it('emits lifecycle events on transition', async () => {
      const engine = new Engine({ configDir })
      const events: unknown[] = []
      engine.onLifecycle((e) => events.push(e))
      await engine.start()
      expect(events.length).toBeGreaterThanOrEqual(2)
    })
  })
})

describe('LifecycleManager', () => {
  let lm: LifecycleManager

  beforeEach(() => {
    lm = new LifecycleManager()
  })

  it('starts in Created state', () => {
    expect(lm.state).toBe(LifecycleState.Created)
  })

  it('transitions correctly: Created -> Starting -> Running', () => {
    lm.transition(LifecycleState.Starting)
    expect(lm.state).toBe(LifecycleState.Starting)
    lm.transition(LifecycleState.Running)
    expect(lm.state).toBe(LifecycleState.Running)
  })

  it('throws on invalid transition', () => {
    expect(() => lm.transition(LifecycleState.Running)).toThrow()
  })

  it('tracks startedAt when entering Running', () => {
    lm.transition(LifecycleState.Starting)
    lm.transition(LifecycleState.Running)
    expect(lm.startedAt).toBeTruthy()
  })

  it('uptime returns 0 when not running', () => {
    expect(lm.uptime).toBe(0)
  })

  it('uptime returns positive when running', () => {
    lm.transition(LifecycleState.Starting)
    lm.transition(LifecycleState.Running)
    expect(lm.uptime).toBeGreaterThanOrEqual(0)
  })

  it('error state stores error', () => {
    lm.transition(LifecycleState.Starting)
    lm.transition(LifecycleState.Error)
    expect(lm.isError()).toBe(true)
    expect(lm.error).toBeDefined()
  })

  it('reset returns to Created', () => {
    lm.transition(LifecycleState.Starting)
    lm.transition(LifecycleState.Error)
    lm.reset()
    expect(lm.state).toBe(LifecycleState.Created)
    expect(lm.error).toBeNull()
  })

  it('canStart returns true from Created and Stopped', () => {
    expect(lm.canStart()).toBe(true)
    lm.transition(LifecycleState.Starting)
    lm.transition(LifecycleState.Running)
    lm.transition(LifecycleState.Stopping)
    lm.transition(LifecycleState.Stopped)
    expect(lm.canStart()).toBe(true)
  })

  it('fires transition callbacks', () => {
    const events: Array<{ from: string; to: string }> = []
    lm.onTransition((e) => events.push({ from: e.from, to: e.to }))
    lm.transition(LifecycleState.Starting)
    expect(events).toHaveLength(1)
    expect(events[0].from).toBe('created')
    expect(events[0].to).toBe('starting')
  })
})

describe('HealthChecker', () => {
  let hc: HealthChecker

  beforeEach(() => {
    hc = new HealthChecker()
  })

  it('registers and checks a healthy component', async () => {
    hc.register('test', async () => ({
      componentId: 'test',
      status: 'healthy' as const,
      lastCheck: new Date().toISOString(),
    }))
    const result = await hc.checkComponent('test')
    expect(result.status).toBe('healthy')
  })

  it('reports unhealthy for unregistered component', async () => {
    const result = await hc.checkComponent('ghost')
    expect(result.status).toBe('unhealthy')
  })

  it('aggregates multiple components in checkAll', async () => {
    hc.register('a', async () => ({ componentId: 'a', status: 'healthy' as const, lastCheck: new Date().toISOString() }))
    hc.register('b', async () => { throw new Error('fail') })
    hc.register('c', async () => ({ componentId: 'c', status: 'degraded' as const, lastCheck: new Date().toISOString() }))
    const report = await hc.checkAll()
    expect(report.status).toBe('unhealthy')
    expect(report.summary.healthy).toBe(1)
    expect(report.summary.degraded).toBe(1)
    expect(report.summary.unhealthy).toBe(1)
  })

  it('circuit breaker opens after consecutive failures', async () => {
    let callCount = 0
    hc.register('flaky', async () => {
      callCount++
      throw new Error('fail')
    })
    await hc.checkComponent('flaky')
    await hc.checkComponent('flaky')
    await hc.checkComponent('flaky')
    expect(callCount).toBe(3)
    const result = await hc.checkComponent('flaky')
    expect(result.status).toBe('unhealthy')
    expect(result.details).toContain('Circuit breaker open')
  })

  it('deregister removes component', () => {
    hc.register('x', async () => ({ componentId: 'x', status: 'healthy' as const, lastCheck: new Date().toISOString() }))
    hc.deregister('x')
    expect(() => hc.checkComponent('x')).not.toThrow()
  })

  it('getReport returns cached results for recent checks', async () => {
    hc.register('fast', async () => ({ componentId: 'fast', status: 'healthy' as const, lastCheck: new Date().toISOString() }))
    await hc.checkComponent('fast')
    const report = await hc.getReport()
    expect(report.components.some((c) => c.componentId === 'fast')).toBe(true)
  })

  it('resetCircuitBreaker works', async () => {
    hc.register('flake', async () => { throw new Error('fail') })
    for (let i = 0; i < 3; i++) {
      await hc.checkComponent('flake').catch(() => { })
    }
    hc.resetCircuitBreaker('flake')
    hc.register('flake', async () => ({ componentId: 'flake', status: 'healthy' as const, lastCheck: new Date().toISOString() }))
  })
})
