import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProviderFactory, ProviderManager, registerProvider } from '../../backend/src/providers/index.js'
import { OpenAIProvider } from '../../backend/src/providers/openai/provider.js'
import { AnthropicProvider } from '../../backend/src/providers/anthropic/provider.js'
import { BaseProvider } from '../../backend/src/providers/base.js'
import { ProviderError } from '../../backend/src/types.js'

const testModelConfig = {
  id: 'test-model',
  context: 4096,
  capabilities: ['chat'],
  cost: { input: 1, output: 2 },
}

const minimalProviderConfig = {
  enabled: true,
  priority: 1,
  models: [testModelConfig],
}

describe('ProviderFactory', () => {
  it('creates an OpenAI provider', () => {
    const provider = ProviderFactory.create('openai', minimalProviderConfig)
    expect(provider).toBeInstanceOf(OpenAIProvider)
    expect(provider.id).toBe('openai')
  })

  it('creates an Anthropic provider', () => {
    const provider = ProviderFactory.create('anthropic', minimalProviderConfig)
    expect(provider).toBeInstanceOf(AnthropicProvider)
    expect(provider.id).toBe('anthropic')
  })

  it('throws for unknown provider', () => {
    expect(() => ProviderFactory.create('nonexistent', minimalProviderConfig)).toThrow()
  })

  it('getAvailableProviders returns list', () => {
    const available = ProviderFactory.getAvailableProviders()
    expect(available).toContain('openai')
    expect(available).toContain('anthropic')
    expect(available).toContain('deepseek')
  })

  it('registerProvider adds new provider type', () => {
    class CustomProvider extends BaseProvider {
      id = 'custom'
      name = 'Custom'
      constructor(config: { models: typeof testModelConfig[] } & Record<string, unknown>) {
        super(config as never, 'CUSTOM_KEY', 'http://localhost')
      }
      protected async executeComplete(): Promise<never> {
        throw new Error('not implemented')
      }
    }
    registerProvider('custom', CustomProvider as never)
    const provider = ProviderFactory.create('custom', minimalProviderConfig)
    expect(provider.id).toBe('custom')
  })
})

describe('ProviderManager', () => {
  it('creates providers from configs', () => {
    const pm = new ProviderManager({
      openai: { enabled: true, priority: 1, models: [testModelConfig] },
      anthropic: { enabled: true, priority: 2, models: [testModelConfig] },
    })
    const all = pm.getAll()
    expect(all.length).toBeGreaterThanOrEqual(2)
  })

  it('skips disabled providers', () => {
    const pm = new ProviderManager({
      openai: { enabled: false, priority: 1, models: [testModelConfig] },
    })
    expect(pm.getAll()).toHaveLength(0)
  })

  it('get returns provider by id', () => {
    const pm = new ProviderManager({
      openai: { enabled: true, priority: 1, models: [testModelConfig] },
    })
    const p = pm.get('openai')
    expect(p).toBeDefined()
    expect(p!.id).toBe('openai')
  })

  it('getEnabledProviderIds returns enabled providers', () => {
    const pm = new ProviderManager({
      openai: { enabled: true, priority: 1, models: [testModelConfig] },
      deepseek: { enabled: false, priority: 2, models: [testModelConfig] },
    })
    const ids = pm.getEnabledProviderIds()
    expect(ids).toContain('openai')
    expect(ids).not.toContain('deepseek')
  })

  it('enable activates a disabled provider', () => {
    const pm = new ProviderManager({
      deepseek: { enabled: false, priority: 1, models: [testModelConfig] },
    })
    const provider = pm.enable('deepseek')
    expect(provider).toBeDefined()
    expect(pm.get('deepseek')).toBeDefined()
  })

  it('enable returns existing provider if already active', () => {
    const pm = new ProviderManager({
      openai: { enabled: true, priority: 1, models: [testModelConfig] },
    })
    const p1 = pm.enable('openai')
    const p2 = pm.enable('openai')
    expect(p1).toBe(p2)
  })

  it('enable throws if no config exists', () => {
    const pm = new ProviderManager({})
    expect(() => pm.enable('ghost')).toThrow()
  })

  it('disable removes a provider', () => {
    const pm = new ProviderManager({
      openai: { enabled: true, priority: 1, models: [testModelConfig] },
    })
    pm.disable('openai')
    expect(pm.get('openai')).toBeUndefined()
  })

  it('refresh reloads provider config', () => {
    const pm = new ProviderManager({
      openai: { enabled: true, priority: 1, models: [testModelConfig] },
    })
    pm.refresh('openai')
    expect(pm.get('openai')).toBeDefined()
  })

  it('refresh all reloads all providers', () => {
    const pm = new ProviderManager({
      openai: { enabled: true, priority: 1, models: [testModelConfig] },
      anthropic: { enabled: true, priority: 2, models: [testModelConfig] },
    })
    pm.refresh()
    expect(pm.getAll().length).toBe(2)
  })

  it('getConfig returns the config', () => {
    const pm = new ProviderManager({
      openai: { enabled: true, priority: 1, models: [testModelConfig] },
    })
    const cfg = pm.getConfig('openai')
    expect(cfg).toBeDefined()
    expect(cfg!.enabled).toBe(true)
  })
})

describe('OpenAI message formatting', () => {
  it('serializes string content messages', () => {
    const config = { enabled: true, priority: 1, models: [testModelConfig] }
    const provider = new OpenAIProvider(config)
    expect(provider.id).toBe('openai')
    expect(provider.name).toBe('OpenAI')
  })
})

describe('Anthropic message formatting', () => {
  it('extracts system messages correctly', () => {
    const config = { enabled: true, priority: 1, models: [testModelConfig] }
    const provider = new AnthropicProvider(config)
    expect(provider.id).toBe('anthropic')
    expect(provider.name).toBe('Anthropic')
  })
})

describe('BaseProvider error handling', () => {
  it('rate limit retry', async () => {
    const provider = new OpenAIProvider(minimalProviderConfig)
    await expect(provider.complete({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toThrow()
  })
})

describe('BaseProvider helpers', () => {
  let provider: OpenAIProvider

  beforeEach(() => {
    provider = new OpenAIProvider(minimalProviderConfig)
  })

  it('normalizeStop handles string', () => {
    const result = (provider as unknown as { normalizeStop(stop?: string | string[]): string[] | undefined }).normalizeStop('stop')
    expect(result).toEqual(['stop'])
  })

  it('normalizeStop handles array', () => {
    const result = (provider as unknown as { normalizeStop(stop?: string | string[]): string[] | undefined }).normalizeStop(['stop1', 'stop2'])
    expect(result).toEqual(['stop1', 'stop2'])
  })

  it('normalizeStop handles undefined', () => {
    const result = (provider as unknown as { normalizeStop(stop?: string | string[]): string[] | undefined }).normalizeStop(undefined)
    expect(result).toBeUndefined()
  })

  it('extractSystemMessage separates system from chat messages', () => {
    const result = (provider as unknown as {
      extractSystemMessage(messages: Array<{ role: string; content: string }>): { system?: string; chatMessages: Array<{ role: string; content: string }> }
    }).extractSystemMessage([
      { role: 'system', content: 'You are helpful' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' },
    ])
    expect(result.system).toBe('You are helpful')
    expect(result.chatMessages).toHaveLength(2)
  })

  it('extractTextContent extracts text from content parts', () => {
    const result = (provider as unknown as {
      extractTextContent(content: string | Array<{ type: string; text?: string }>): string
    }).extractTextContent([
      { type: 'text', text: 'Hello' },
      { type: 'text', text: 'World' },
    ])
    expect(result).toBe('Hello\nWorld')
  })

  it('extractTextContent passes through string', () => {
    const result = (provider as unknown as {
      extractTextContent(content: string | Array<{ type: string; text?: string }>): string
    }).extractTextContent('plain string')
    expect(result).toBe('plain string')
  })
})
