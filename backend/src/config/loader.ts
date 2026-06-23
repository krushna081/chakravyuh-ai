import { readFileSync, existsSync, watchFile, unwatchFile } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { ConfigError } from '../errors.js'
import { logger } from '../logger.js'
import type { AgentConfig, RoutingStrategy, ModelCapability } from '../types.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const ModelCapabilityEnum = z.enum(['chat', 'code', 'vision', 'reasoning', 'audio', 'embedding'])

const RoutingStrategySchema = z.object({
  type: z.enum(['fixed', 'fallback', 'capability', 'cheapest', 'fastest', 'ensemble']),
  provider: z.string().optional(),
  model: z.string().optional(),
  minCapability: ModelCapabilityEnum.optional(),
  prefer: z.array(z.string()).optional(),
  preferCheapest: z.boolean().optional(),
  fallbacks: z.array(z.string()).optional(),
})

const AgentConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  systemPrompt: z.string(),
  provider: z.union([z.string(), RoutingStrategySchema]),
  model: z.string().optional().default(''),
  tools: z.array(z.string()),
  memoryScope: z.array(z.enum(['working', 'episodic', 'semantic', 'procedural'])),
  allowedPeers: z.array(z.string()),
  limits: z.object({
    maxTokensPerTask: z.number(),
    maxConsecutiveCalls: z.number(),
    timeout: z.number(),
  }),
  health: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy']),
    lastHeartbeat: z.string(),
    errorCount: z.number(),
  }).optional().default({ status: 'healthy', lastHeartbeat: new Date().toISOString(), errorCount: 0 }),
})

interface ProviderModel {
  id: string
  context: number
  capabilities: string[]
  cost: { input: number; output: number }
  rateLimit?: { rpm: number; tpm: number }
}

interface ProviderConfig {
  enabled: boolean
  priority: number
  baseUrl?: string
  models: ProviderModel[]
  defaults?: { temperature?: number; maxTokens?: number; maxOutputTokens?: number }
}

interface ProvidersFile {
  providers: Record<string, ProviderConfig>
}

interface AgentsFile {
  agents: Record<string, Omit<AgentConfig, 'id'>>
}

interface MCPServerConfig {
  enabled: boolean
  autoStart: boolean
  command: string
  args: string[]
  env: Record<string, string>
}

interface MCPFile {
  servers: Record<string, MCPServerConfig>
}

function parseYamlSimple(raw: string): unknown {
  const lines = raw.split('\n')
  const result: Record<string, unknown> = {}
  const stack: Array<{ indent: number; key: string; value: unknown; parent: Record<string, unknown> }> = []
  let current = result
  let currentIndent = -1

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const indent = line.length - line.trimStart().length

    if (trimmed.endsWith(':')) {
      const key = trimmed.slice(0, -1).trim()
      const newObj: Record<string, unknown> = {}
      current[key] = newObj
      stack.push({ indent: currentIndent, key: '', value: current, parent: current })
      currentIndent = indent
      current = newObj
    } else if (trimmed.includes(': ')) {
      const sepIdx = trimmed.indexOf(': ')
      const key = trimmed.slice(0, sepIdx).trim()
      let value: unknown = trimmed.slice(sepIdx + 2).trim()

      if (value === 'true') value = true
      else if (value === 'false') value = false
      else if (/^-?\d+(\.\d+)?$/.test(String(value))) {
        value = String(value).includes('.') ? parseFloat(String(value)) : parseInt(String(value), 10)
      } else if (String(value).startsWith('"') && String(value).endsWith('"')) {
        value = String(value).slice(1, -1)
      } else if (String(value).startsWith("'") && String(value).endsWith("'")) {
        value = String(value).slice(1, -1)
      }

      current[key] = value
    } else if (trimmed.startsWith('- ')) {
      const item = trimmed.slice(2).trim()
      const key = Object.keys(current).find((k) => Array.isArray(current[k]))
      if (key && Array.isArray(current[key])) {
        (current[key] as unknown[]).push(parseYamlValue(item))
      } else if (trimmed.includes(': ')) {
        const sepIdx = trimmed.indexOf(': ')
        const arrKey = trimmed.slice(2, sepIdx).trim()
        const arrVal = trimmed.slice(sepIdx + 2).trim()
        if (!current[arrKey]) {
          current[arrKey] = []
        }
        ;(current[arrKey] as unknown[]).push(parseYamlValue(arrVal))
      }
    } else if (stack.length > 0) {
      const prev = stack.pop()
      if (prev) {
        currentIndent = prev.indent
        current = prev.value as Record<string, unknown>
      }
    }
  }

  return result
}

function parseYamlValue(value: string): unknown {
  const t = value.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null' || t === '~') return null
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    return t.includes('.') ? parseFloat(t) : parseInt(t, 10)
  }
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1)
  }
  return t
}

function deepMergeArray(arr: string[]): unknown[] {
  const result: unknown[] = []
  for (const item of arr) {
    if (typeof item === 'string' && item.startsWith('- ')) {
      result.push(parseYamlValue(item.slice(2)))
    } else {
      result.push(parseYamlValue(item))
    }
  }
  return result
}

export class ConfigManager {
  private configDir: string
  private providers: ProvidersFile | null = null
  private agents: AgentsFile | null = null
  private mcp: MCPFile | null = null
  private loaded = false

  constructor(configDir?: string) {
    this.configDir = configDir ?? join(__dirname, '..', '..', '..', 'config')
  }

  async loadAll(): Promise<void> {
    this.providers = await this.loadProviders()
    this.agents = await this.loadAgents()
    this.mcp = await this.loadMCP()
    this.loaded = true
    logger.info('All configs loaded', { source: 'ConfigManager', configDir: this.configDir })
  }

  async loadProviders(): Promise<ProvidersFile> {
    const filePath = join(this.configDir, 'providers.yaml')
    return this.parseConfigFile<ProvidersFile>(filePath)
  }

  async loadAgents(): Promise<AgentsFile> {
    const filePath = join(this.configDir, 'agents.yaml')
    return this.parseConfigFile<AgentsFile>(filePath)
  }

  async loadMCP(): Promise<MCPFile> {
    const filePath = join(this.configDir, 'mcp.yaml')
    return this.parseConfigFile<MCPFile>(filePath)
  }

  getProviders(): ProvidersFile {
    if (!this.providers) throw new ConfigError('Providers config not loaded')
    return this.providers
  }

  getAgents(): AgentsFile {
    if (!this.agents) throw new ConfigError('Agents config not loaded')
    return this.agents
  }

  getMCP(): MCPFile {
    if (!this.mcp) throw new ConfigError('MCP config not loaded')
    return this.mcp
  }

  getAgentConfigs(): AgentConfig[] {
    const agents = this.getAgents()

    return Object.entries(agents.agents).map(([id, cfg]) => {
      const parsed = AgentConfigSchema.parse({
        id,
        ...cfg,
      })

      if (typeof cfg.systemPrompt === 'string' && cfg.systemPrompt.endsWith('.md')) {
        const promptPath = join(this.configDir, '..', cfg.systemPrompt)
        try {
          parsed.systemPrompt = readFileSync(promptPath, 'utf-8')
        } catch {
          logger.warn(`System prompt file not found: ${cfg.systemPrompt}`, { source: 'ConfigManager' })
        }
      }

      return parsed as AgentConfig
    })
  }

  getAgentConfig(id: string): AgentConfig | undefined {
    return this.getAgentConfigs().find((a) => a.id === id)
  }

  async healthCheck(): Promise<{ componentId: string; status: 'healthy' | 'unhealthy'; lastCheck: string; details?: string }> {
    try {
      if (!this.loaded) {
        return {
          componentId: 'config',
          status: 'unhealthy',
          lastCheck: new Date().toISOString(),
          details: 'Config not loaded',
        }
      }

      const providers = this.getProviders()
      const agents = this.getAgents()
      const mcp = this.getMCP()

      const providerCount = Object.keys(providers.providers).length
      const agentCount = Object.keys(agents.agents).length
      const mcpCount = Object.keys(mcp.servers).length

      return {
        componentId: 'config',
        status: 'healthy',
        lastCheck: new Date().toISOString(),
        details: `${providerCount} providers, ${agentCount} agents, ${mcpCount} MCP servers`,
      }
    } catch (error) {
      return {
        componentId: 'config',
        status: 'unhealthy',
        lastCheck: new Date().toISOString(),
        details: error instanceof Error ? error.message : String(error),
      }
    }
  }

  setupHotReload(callback?: () => void): void {
    const files = ['providers.yaml', 'agents.yaml', 'mcp.yaml']
    for (const file of files) {
      const filePath = join(this.configDir, file)
      if (!existsSync(filePath)) continue

      watchFile(filePath, { interval: 2000 }, () => {
        logger.info(`Config file changed: ${file}`, { source: 'ConfigManager' })
        this.loaded = false
        this.loadAll()
          .then(() => callback?.())
          .catch((err) => logger.error(`Failed to reload ${file}`, { source: 'ConfigManager', error: err }))
      })
    }
  }

  stopHotReload(): void {
    const files = ['providers.yaml', 'agents.yaml', 'mcp.yaml']
    for (const file of files) {
      const filePath = join(this.configDir, file)
      if (existsSync(filePath)) {
        unwatchFile(filePath)
      }
    }
  }

  private parseConfigFile<T>(filePath: string): T {
    try {
      if (!existsSync(filePath)) {
        throw new ConfigError(`Config file not found: ${filePath}`)
      }

      const raw = readFileSync(filePath, 'utf-8')
      const parsed = parseYamlSimple(raw) as T

      return parsed
    } catch (error) {
      if (error instanceof ConfigError) throw error
      throw new ConfigError(`Failed to parse ${filePath}`, error)
    }
  }
}
