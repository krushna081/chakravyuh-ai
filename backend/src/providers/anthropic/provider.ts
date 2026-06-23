import {
  type CompletionRequest,
  type CompletionResponse,
  type CompletionChunk,
  type ProviderConfig,
  ProviderError,
} from '../../types.js'
import { BaseProvider, type SSEEvent } from '../base.js'

export class AnthropicProvider extends BaseProvider {
  id = 'anthropic'
  name = 'Anthropic'

  constructor(config: ProviderConfig) {
    super(config, 'ANTHROPIC_API_KEY', 'https://api.anthropic.com/v1')
  }

  protected override async executeComplete(
    req: CompletionRequest,
  ): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new ProviderError(
        'ANTHROPIC_API_KEY is not configured',
        undefined,
        'auth',
      )
    }

    const { system, chatMessages } = this.extractSystemMessage(req.messages)

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? this.defaults?.maxTokens ?? 4096,
      messages: chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: this.mapContent(m.content),
      })),
    }

    if (system) {
      body.system = system
    }
    if (req.temperature !== undefined) {
      body.temperature = req.temperature
    } else if (this.defaults?.temperature !== undefined) {
      body.temperature = this.defaults.temperature
    }
    if (req.stop !== undefined) {
      body.stop_sequences = this.normalizeStop(req.stop)
    }

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
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
        'ANTHROPIC_API_KEY is not configured',
        undefined,
        'auth',
      )
    }

    const { system, chatMessages } = this.extractSystemMessage(req.messages)

    const body: Record<string, unknown> = {
      model: req.model,
      max_tokens: req.maxTokens ?? this.defaults?.maxTokens ?? 4096,
      messages: chatMessages.map(m => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: this.mapContent(m.content),
      })),
      stream: true,
    }

    if (system) {
      body.system = system
    }
    if (req.temperature !== undefined) {
      body.temperature = req.temperature
    } else if (this.defaults?.temperature !== undefined) {
      body.temperature = this.defaults.temperature
    }
    if (req.stop !== undefined) {
      body.stop_sequences = this.normalizeStop(req.stop)
    }

    const response = await fetch(`${this.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      await this.handleError(response)
    }

    let messageId = ''
    let messageModel = ''

    for await (const event of this.parseSSEEvents(response)) {
      switch (event.event) {
        case 'message_start': {
          const msg = event.data.message as Record<string, unknown> | undefined
          if (msg) {
            messageId = (msg.id as string) ?? ''
            messageModel = (msg.model as string) ?? ''
          }
          break
        }
        case 'content_block_delta': {
          const delta = event.data.delta as Record<string, unknown> | undefined
          if (delta?.type === 'text_delta') {
            yield this.makeCompletionChunk(messageId, messageModel, [
              {
                index: 0,
                delta: { content: delta.text as string | undefined },
                finishReason: null,
              },
            ])
          }
          break
        }
        case 'message_delta': {
          const delta = event.data.delta as
            | Record<string, unknown>
            | undefined
          const stopReason = delta?.stop_reason as string | null | undefined
          yield this.makeCompletionChunk(messageId, messageModel, [
            {
              index: 0,
              delta: {},
              finishReason: this.mapStopReason(stopReason ?? null),
            },
          ])
          break
        }
        case 'message_stop': {
          return
        }
      }
    }
  }

  private mapContent(
    content: string | { type: string; text?: string; image_url?: { url: string } }[],
  ): string | Array<Record<string, unknown>> {
    if (typeof content === 'string') return content
    return content.map(part => {
      if (part.type === 'image_url' && part.image_url) {
        return {
          type: 'image',
          source: {
            type: 'url',
            url: part.image_url.url,
          },
        }
      }
      return { type: 'text', text: part.text }
    })
  }

  private mapResponse(data: Record<string, unknown>): CompletionResponse {
    const id = data.id as string
    const model = data.model as string
    const contentData = data.content as
      | Array<Record<string, unknown>>
      | undefined
    const stopReason = data.stop_reason as string | null | undefined

    if (!contentData) {
      throw new ProviderError(
        'Missing content in Anthropic response',
        0,
        'server_error',
      )
    }

    const text = contentData
      .filter(c => c.type === 'text')
      .map(c => c.text as string)
      .join('')

    const usageData = data.usage as Record<string, number> | undefined

    const result: CompletionResponse = {
      id,
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: text,
          },
          finishReason: this.mapStopReason(stopReason ?? null),
        },
      ],
    }

    if (usageData) {
      result.usage = {
        promptTokens: usageData.input_tokens ?? 0,
        completionTokens: usageData.output_tokens ?? 0,
        totalTokens: (usageData.input_tokens ?? 0) + (usageData.output_tokens ?? 0),
      }
    }

    return result
  }

  private mapStopReason(
    reason: string | null,
  ): 'stop' | 'length' | null {
    if (reason === 'end_turn' || reason === 'stop') return 'stop'
    if (reason === 'max_tokens') return 'length'
    return null
  }
}
