import { type LLMProvider, type ProviderConfig } from '../types.js'
import { BaseProvider } from './base.js'
import { OpenAIProvider } from './openai/provider.js'
import { AnthropicProvider } from './anthropic/provider.js'
import { GoogleProvider } from './google/provider.js'
import { DeepSeekProvider } from './deepseek/provider.js'
import { GrokProvider } from './grok/provider.js'
import { OpenRouterProvider } from './openrouter/provider.js'
import { OllamaProvider } from './ollama/provider.js'

export { BaseProvider }
export { OpenAIProvider } from './openai/provider.js'
export { AnthropicProvider } from './anthropic/provider.js'
export { GoogleProvider } from './google/provider.js'
export { DeepSeekProvider } from './deepseek/provider.js'
export { GrokProvider } from './grok/provider.js'
export { OpenRouterProvider } from './openrouter/provider.js'
export { OllamaProvider } from './ollama/provider.js'

export type ProviderConstructor = new (config: ProviderConfig) => LLMProvider

const providerRegistry: Record<string, ProviderConstructor> = {
  openai: OpenAIProvider,
  anthropic: AnthropicProvider,
  google: GoogleProvider,
  deepseek: DeepSeekProvider,
  grok: GrokProvider,
  openrouter: OpenRouterProvider,
  ollama: OllamaProvider,
}

export function registerProvider(
  id: string,
  ctor: ProviderConstructor,
): void {
  providerRegistry[id] = ctor
}

export class ProviderFactory {
  static create(id: string, config: ProviderConfig): LLMProvider {
    const Constructor = providerRegistry[id]
    if (!Constructor) {
      throw new Error(`Unknown provider: "${id}". Available providers: ${Object.keys(providerRegistry).join(', ')}`)
    }
    return new Constructor(config)
  }

  static getAvailableProviders(): string[] {
    return Object.keys(providerRegistry)
  }
}

export const defaultProviderConfigs: Record<string, ProviderConfig> = {
  openai: {
    enabled: true,
    priority: 1,
    models: [
      {
        id: 'gpt-4o',
        context: 128000,
        capabilities: ['chat', 'code', 'vision', 'reasoning'],
        cost: { input: 2.5, output: 10.0 },
      },
      {
        id: 'gpt-4o-mini',
        context: 128000,
        capabilities: ['chat', 'code', 'vision'],
        cost: { input: 0.15, output: 0.6 },
      },
      {
        id: 'o1',
        context: 200000,
        capabilities: ['chat', 'code', 'reasoning'],
        cost: { input: 15.0, output: 60.0 },
      },
      {
        id: 'o1-mini',
        context: 128000,
        capabilities: ['chat', 'code', 'reasoning'],
        cost: { input: 1.1, output: 4.4 },
      },
    ],
    defaults: { temperature: 0.7, maxTokens: 4096 },
  },
  anthropic: {
    enabled: true,
    priority: 2,
    models: [
      {
        id: 'claude-sonnet-4-20250514',
        context: 200000,
        capabilities: ['chat', 'code', 'vision', 'reasoning'],
        cost: { input: 3.0, output: 15.0 },
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        context: 200000,
        capabilities: ['chat', 'code', 'vision'],
        cost: { input: 3.0, output: 15.0 },
      },
      {
        id: 'claude-3-5-haiku-20241022',
        context: 200000,
        capabilities: ['chat', 'code'],
        cost: { input: 0.8, output: 4.0 },
      },
    ],
    defaults: { temperature: 0.7, maxTokens: 8192 },
  },
  google: {
    enabled: true,
    priority: 3,
    models: [
      {
        id: 'gemini-2.5-pro-exp-03-25',
        context: 1048576,
        capabilities: ['chat', 'code', 'vision', 'reasoning', 'audio'],
        cost: { input: 1.25, output: 5.0 },
      },
      {
        id: 'gemini-2.0-flash',
        context: 1048576,
        capabilities: ['chat', 'code', 'vision', 'audio'],
        cost: { input: 0.1, output: 0.4 },
      },
    ],
    defaults: { temperature: 0.7, maxTokens: 8192 },
  },
  deepseek: {
    enabled: true,
    priority: 4,
    models: [
      {
        id: 'deepseek-chat',
        context: 128000,
        capabilities: ['chat', 'code'],
        cost: { input: 0.14, output: 0.28 },
      },
      {
        id: 'deepseek-coder',
        context: 128000,
        capabilities: ['code'],
        cost: { input: 0.14, output: 0.28 },
      },
      {
        id: 'deepseek-reasoner',
        context: 128000,
        capabilities: ['chat', 'reasoning'],
        cost: { input: 0.55, output: 2.19 },
      },
    ],
    defaults: { temperature: 0.7, maxTokens: 8192 },
  },
  grok: {
    enabled: false,
    priority: 5,
    models: [
      {
        id: 'grok-2',
        context: 131072,
        capabilities: ['chat', 'code', 'vision'],
        cost: { input: 2.0, output: 10.0 },
      },
      {
        id: 'grok-2-mini',
        context: 131072,
        capabilities: ['chat', 'code'],
        cost: { input: 0.3, output: 1.5 },
      },
    ],
    defaults: { temperature: 0.7, maxTokens: 4096 },
  },
  openrouter: {
    enabled: false,
    priority: 6,
    models: [],
    defaults: { temperature: 0.7, maxTokens: 4096 },
  },
  ollama: {
    enabled: false,
    priority: 7,
    baseUrl: 'http://localhost:11434',
    models: [
      {
        id: 'llama3.1:8b',
        context: 8192,
        capabilities: ['chat', 'code'],
        cost: { input: 0, output: 0 },
      },
      {
        id: 'llama3.1:70b',
        context: 8192,
        capabilities: ['chat', 'code', 'reasoning'],
        cost: { input: 0, output: 0 },
      },
      {
        id: 'mistral:7b',
        context: 8192,
        capabilities: ['chat', 'code'],
        cost: { input: 0, output: 0 },
      },
      {
        id: 'codellama:34b',
        context: 16384,
        capabilities: ['code'],
        cost: { input: 0, output: 0 },
      },
    ],
    defaults: { temperature: 0.7, maxTokens: 4096 },
  },
}

export class ProviderManager {
  private providers: Map<string, LLMProvider> = new Map()
  private configs: Record<string, ProviderConfig>

  constructor(configs?: Record<string, ProviderConfig>) {
    this.configs = configs ?? defaultProviderConfigs
    for (const [id, config] of Object.entries(this.configs)) {
      if (config.enabled) {
        this.createAndRegister(id, config)
      }
    }
  }

  static fromProviderConfigs(
    providerConfigs: Record<string, ProviderConfig>,
  ): ProviderManager {
    return new ProviderManager(providerConfigs)
  }

  static fromConfigLoader(
    configs: { providers: Record<string, Record<string, unknown>> },
  ): ProviderManager {
    const normalized: Record<string, ProviderConfig> = {}
    for (const [id, raw] of Object.entries(configs.providers)) {
      const rc = raw as Record<string, unknown>
      normalized[id] = {
        enabled: (rc.enabled as boolean) ?? false,
        priority: (rc.priority as number) ?? 99,
        baseUrl: rc.baseUrl as string | undefined,
        models: Array.isArray(rc.models)
          ? (rc.models as Array<Record<string, unknown>>).map((m) => ({
              id: m.id as string,
              context: (m.context as number) ?? 4096,
              capabilities: (m.capabilities as string[]) ?? [],
              cost: {
                input: ((m.cost as Record<string, number>)?.input) ?? 0,
                output: ((m.cost as Record<string, number>)?.output) ?? 0,
              },
            }))
          : [],
        defaults: rc.defaults
          ? {
              temperature: (rc.defaults as Record<string, unknown>)
                ?.temperature as number | undefined,
              maxTokens:
                ((rc.defaults as Record<string, unknown>)
                  ?.maxTokens as number) ??
                ((rc.defaults as Record<string, unknown>)
                  ?.maxOutputTokens as number) ??
                undefined,
            }
          : undefined,
      }
    }
    return new ProviderManager(normalized)
  }

  private createAndRegister(id: string, config: ProviderConfig): LLMProvider {
    const provider = ProviderFactory.create(id, config)
    this.providers.set(id, provider)
    return provider
  }

  get(id: string): LLMProvider | undefined {
    return this.providers.get(id)
  }

  getAll(): LLMProvider[] {
    return Array.from(this.providers.values())
  }

  getEnabledProviderIds(): string[] {
    return Array.from(this.providers.keys())
  }

  enable(id: string): LLMProvider {
    const existing = this.providers.get(id)
    if (existing) return existing

    const config = this.configs[id]
    if (!config) {
      throw new Error(`No configuration found for provider: "${id}"`)
    }

    return this.createAndRegister(id, config)
  }

  disable(id: string): void {
    this.providers.delete(id)
  }

  refresh(id?: string): void {
    if (id) {
      const config = this.configs[id]
      if (config) {
        this.providers.delete(id)
        this.createAndRegister(id, config)
      }
    } else {
      const currentIds = Array.from(this.providers.keys())
      for (const cid of currentIds) {
        this.providers.delete(cid)
      }
      for (const [pid, pconfig] of Object.entries(this.configs)) {
        if (pconfig.enabled) {
          this.createAndRegister(pid, pconfig)
        }
      }
    }
  }

  getConfig(id: string): ProviderConfig | undefined {
    return this.configs[id]
  }

  async initAll(): Promise<void> {
    // future: warm up providers, validate API keys, etc.
  }

  async destroyAll(): Promise<void> {
    this.providers.clear()
  }
}
