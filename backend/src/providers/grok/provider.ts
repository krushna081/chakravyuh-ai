import {
  type CompletionRequest,
  type CompletionResponse,
  type CompletionChunk,
  type ProviderConfig,
  ProviderError,
} from '../../types.js'
import { BaseProvider, type SSEEvent } from '../base.js'

export class GrokProvider extends BaseProvider {
  id = 'grok'
  name = 'Grok (xAI)'

  constructor(config: ProviderConfig) {
    super(config, 'GROK_API_KEY', 'https://api.x.ai/v1')
  }

  protected override async executeComplete(
    req: CompletionRequest,
  ): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new ProviderError(
        'GROK_API_KEY is not configured',
        undefined,
        'auth',
      )
    }

    const body = this.buildRequestBody(req, false)

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      await this.handleError(response)
    }

    const data = (await response.json()) as Record<string, unknown>
    return this.mapResponse(data)
  }

  override async *stream(
    req: CompletionRequest,
  ): AsyncIterable<CompletionChunk> {
    if (!this.apiKey) {
      throw new ProviderError(
        'GROK_API_KEY is not configured',
        undefined,
        'auth',
      )
    }

    const body = this.buildRequestBody(req, true)

    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      await this.handleError(response)
    }

    for await (const event of this.parseSSEEvents(response)) {
      const chunk = this.mapStreamChunk(event)
      if (chunk) yield chunk
    }
  }

  private buildRequestBody(
    req: CompletionRequest,
    stream: boolean,
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: req.model,
      messages: req.messages.map(m => ({
        role: m.role,
        content: this.serializeContent(m.content),
      })),
      stream,
    }

    if (req.temperature !== undefined) {
      body.temperature = req.temperature
    } else if (this.defaults?.temperature !== undefined) {
      body.temperature = this.defaults.temperature
    }
    if (req.maxTokens !== undefined) {
      body.max_tokens = req.maxTokens
    } else if (this.defaults?.maxTokens !== undefined) {
      body.max_tokens = this.defaults.maxTokens
    }
    if (req.stop !== undefined) {
      body.stop = req.stop
    }

    return body
  }

  private mapResponse(data: Record<string, unknown>): CompletionResponse {
    const id = data.id as string
    const model = data.model as string
    const choicesData = data.choices as Array<Record<string, unknown>> | undefined

    if (!choicesData) {
      throw new ProviderError(
        'Missing choices in Grok response',
        0,
        'server_error',
      )
    }

    const choices = choicesData.map((c, i) => {
      const messageData = c.message as Record<string, unknown> | undefined
      return {
        index: i,
        message: {
          role: (messageData?.role as 'assistant') ?? 'assistant',
          content: (messageData?.content as string) ?? '',
        },
        finishReason: this.mapFinishReason(c.finish_reason as string | null),
      }
    })

    const usageData = data.usage as Record<string, number> | undefined

    const result: CompletionResponse = { id, model, choices }

    if (usageData) {
      result.usage = {
        promptTokens: usageData.prompt_tokens ?? 0,
        completionTokens: usageData.completion_tokens ?? 0,
        totalTokens: usageData.total_tokens ?? 0,
      }
    }

    return result
  }

  private mapStreamChunk(
    event: SSEEvent,
  ): CompletionChunk | undefined {
    const data = event.data
    const id = data.id as string | undefined
    const model = data.model as string | undefined
    const choicesData = data.choices as
      | Array<Record<string, unknown>>
      | undefined

    if (!id || !model || !choicesData) return undefined

    const choices = choicesData.map((c, i) => {
      const delta = c.delta as Record<string, unknown> | undefined
      return {
        index: i,
        delta: {
          content: delta?.content as string | undefined,
          role: delta?.role as string | undefined,
        },
        finishReason: this.mapFinishReason(
          c.finish_reason as string | null,
        ),
      }
    })

    return this.makeCompletionChunk(id, model, choices)
  }

  private mapFinishReason(
    reason: string | null,
  ): 'stop' | 'length' | null {
    if (reason === 'stop') return 'stop'
    if (reason === 'length') return 'length'
    return null
  }
}
