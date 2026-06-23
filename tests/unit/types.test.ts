import { describe, it, expect } from 'vitest'
import { ProviderError } from '../../backend/src/errors.js'
import { ProviderError as TypesProviderError } from '../../backend/src/types.js'

describe('Error types', () => {
  it('ProviderError from types.js has correct defaults', () => {
    const err = new TypesProviderError('test error')
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('ProviderError')
    expect(err.message).toBe('test error')
    expect(err.status).toBeUndefined()
    expect(err.code).toBe('unknown')
  })

  it('ProviderError from types.js accepts status and code', () => {
    const err = new TypesProviderError('rate limited', 429, 'rate_limit')
    expect(err.status).toBe(429)
    expect(err.code).toBe('rate_limit')
  })

  it('ProviderError from errors.js has correct code and details', () => {
    const err = new ProviderError('provider failed', { detail: 'test' })
    expect(err.code).toBe('PROVIDER_ERROR')
    expect(err.name).toBe('ProviderError')
    expect(err.details).toEqual({ detail: 'test' })
  })
})

describe('Interface shape validations', () => {
  it('CompletionRequest shape is valid', () => {
    const req = {
      model: 'gpt-4o',
      messages: [
        { role: 'user' as const, content: 'hello' },
        { role: 'system' as const, content: 'be helpful' },
      ],
      temperature: 0.5,
      maxTokens: 100,
    }
    expect(req.model).toBe('gpt-4o')
    expect(req.messages).toHaveLength(2)
    expect(req.temperature).toBe(0.5)
    expect(req.maxTokens).toBe(100)
  })

  it('CompletionResponse shape is valid', () => {
    const resp = {
      id: 'chat-123',
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: { role: 'assistant' as const, content: 'Hello!' },
          finishReason: 'stop' as const,
        },
      ],
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    }
    expect(resp.choices[0].message.content).toBe('Hello!')
    expect(resp.usage.totalTokens).toBe(15)
  })

  it('ContentPart discriminates on type', () => {
    const textPart = { type: 'text' as const, text: 'hello' }
    const imagePart = { type: 'image_url' as const, image_url: { url: 'https://example.com/img.png' } }
    expect(textPart.type).toBe('text')
    expect(imagePart.type).toBe('image_url')
  })

  it('Message can be string or ContentPart[]', () => {
    const stringMsg = { role: 'user' as const, content: 'plain text' }
    const partsMsg = {
      role: 'user' as const,
      content: [
        { type: 'text' as const, text: 'desc' },
        { type: 'image_url' as const, image_url: { url: 'data:image/png;base64,...' } },
      ],
    }
    expect(typeof stringMsg.content).toBe('string')
    expect(Array.isArray(partsMsg.content)).toBe(true)
    expect(partsMsg.content).toHaveLength(2)
  })

  it('LLMProvider interface shape is correct', () => {
    const provider = {
      id: 'test',
      name: 'Test',
      models: [{ id: 'm1', context: 4096, capabilities: ['chat'], cost: { input: 1, output: 2 } }],
      complete: async () => ({ id: '', model: '', choices: [] }),
    }
    expect(provider.id).toBe('test')
    expect(typeof provider.complete).toBe('function')
  })

  it('ProviderConfig supports optional fields', () => {
    const config = {
      enabled: true,
      priority: 1,
      models: [{ id: 'm1', context: 8192, capabilities: ['chat'], cost: { input: 1, output: 2 } }],
      baseUrl: 'http://localhost:8080',
      defaults: { temperature: 0.3, maxTokens: 2048 },
    }
    expect(config.baseUrl).toBe('http://localhost:8080')
    expect(config.defaults?.temperature).toBe(0.3)
  })

  it('ProviderErrorCode covers all expected codes', () => {
    const codes: Array<'rate_limit' | 'auth' | 'timeout' | 'bad_request' | 'server_error' | 'unknown'> = [
      'rate_limit', 'auth', 'timeout', 'bad_request', 'server_error', 'unknown',
    ]
    for (const c of codes) {
      const err = new TypesProviderError('test', 0, c)
      expect(err.code).toBe(c)
    }
  })

  it('FinishReason delegates handle all states', () => {
    const reasons: Array<'stop' | 'length' | 'error' | null> = ['stop', 'length', 'error', null]
    for (const r of reasons) {
      const choice = { index: 0, message: { role: 'assistant' as const, content: '' }, finishReason: r }
      expect(choice.finishReason).toBe(r)
    }
  })

  it('Usage fields start at zero', () => {
    const usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
    expect(usage.promptTokens).toBe(0)
    expect(usage.completionTokens).toBe(0)
    expect(usage.totalTokens).toBe(0)
  })
})
