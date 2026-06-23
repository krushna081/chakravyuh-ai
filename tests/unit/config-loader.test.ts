import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ConfigManager } from '../../backend/src/config/loader.js'
import { ConfigError } from '../../backend/src/errors.js'
import { writeFileSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import os from 'node:os'

function tmpDir(): string {
  const d = join(os.tmpdir(), `cfg-test-${randomUUID()}`)
  mkdirSync(d, { recursive: true })
  return d
}

function writeYaml(dir: string, name: string, content: string): string {
  const p = join(dir, name)
  writeFileSync(p, content, 'utf-8')
  return p
}

const providerYaml = `providers:
  openai:
    enabled: true
    priority: 1
    models:
      - id: gpt-4o
        context: 128000
        cost:
          input: 2.5
          output: 10.0
`

const agentYaml = `agents:
  coordinator:
    name: Coordinator
    role: coordinator
    systemPrompt: You are the coordinator
    provider: openai
    model: gpt-4o
    tools:
      - task-analysis
      - delegation
    memoryScope:
      - working
      - episodic
    allowedPeers:
      - planner
      - coder
    limits:
      maxTokensPerTask: 4000
      maxConsecutiveCalls: 10
      timeout: 30000
`

const mcpYaml = `servers:
  filesystem:
    enabled: true
    autoStart: true
    command: node
    env:
      NODE_ENV: production
`

describe('ConfigManager', () => {
  let configDir: string
  let manager: ConfigManager

  beforeEach(() => {
    configDir = tmpDir()
    manager = new ConfigManager(configDir)
  })

  afterEach(() => {
    try { rmSync(configDir, { recursive: true, force: true }) } catch { }
  })

  describe('loading valid YAML configs', () => {
    it('loads providers.yaml successfully', async () => {
      writeYaml(configDir, 'providers.yaml', providerYaml)
      writeYaml(configDir, 'agents.yaml', agentYaml)
      writeYaml(configDir, 'mcp.yaml', mcpYaml)
      await manager.loadAll()
      const providers = manager.getProviders()
      expect(providers.providers.openai).toBeDefined()
      expect(providers.providers.openai.enabled).toBe(true)
    })

    it('loads mcp.yaml with server definitions', async () => {
      writeYaml(configDir, 'providers.yaml', providerYaml)
      writeYaml(configDir, 'agents.yaml', agentYaml)
      writeYaml(configDir, 'mcp.yaml', mcpYaml)
      await manager.loadAll()
      const mcp = manager.getMCP()
      expect(mcp.servers.filesystem).toBeDefined()
      expect(mcp.servers.filesystem.command).toBe('node')
    })

    it('loads all three config files together', async () => {
      writeYaml(configDir, 'providers.yaml', providerYaml)
      writeYaml(configDir, 'agents.yaml', agentYaml)
      writeYaml(configDir, 'mcp.yaml', mcpYaml)
      await manager.loadAll()
      expect(manager.getProviders().providers.openai).toBeDefined()
      expect(manager.getAgents().agents.coordinator).toBeDefined()
      expect(manager.getMCP().servers.filesystem).toBeDefined()
    })
  })

  describe('error handling for missing/invalid configs', () => {
    it('throws ConfigError when providers.yaml is missing', async () => {
      await expect(manager.loadAll()).rejects.toThrow(ConfigError)
    })

    it('throws ConfigError for malformed YAML', async () => {
      writeYaml(configDir, 'providers.yaml', '{{ invalid yaml')
      await expect(manager.loadAll()).rejects.toThrow(ConfigError)
    })

    it('throws when accessing unloaded config', () => {
      expect(() => manager.getProviders()).toThrow(ConfigError)
      expect(() => manager.getAgents()).toThrow(ConfigError)
      expect(() => manager.getMCP()).toThrow(ConfigError)
    })
  })

  describe('health check', () => {
    it('returns unhealthy when not loaded', async () => {
      const health = await manager.healthCheck()
      expect(health.status).toBe('unhealthy')
      expect(health.componentId).toBe('config')
    })

    it('returns healthy when all configs loaded', async () => {
      writeYaml(configDir, 'providers.yaml', providerYaml)
      writeYaml(configDir, 'agents.yaml', agentYaml)
      writeYaml(configDir, 'mcp.yaml', mcpYaml)
      await manager.loadAll()
      const health = await manager.healthCheck()
      expect(health.status).toBe('healthy')
      expect(health.details).toContain('1 providers')
    })
  })
})
