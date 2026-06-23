import {
  type CompletionRequest,
  type CompletionResponse,
  type CompletionChunk,
  type ProviderConfig,
  ProviderError,
} from '../../types.js'
import { BaseProvider, type SSEEvent } from '../base.js'

export class GoogleProvider extends BaseProvider {
  id = 'google'
  name = 'Google Gemini'

  constructor(config: ProviderConfig) {
    super(config, 'GOOGLE_API_KEY', 'https://generativelanguage.googleapis.com/v1beta')
  }

  protected override async executeComplete(
    req: CompletionRequest,
  ): Promise<CompletionResponse> {
    if (!this.apiKey) {
      throw new ProviderError(
        'GOOGLE_API_KEY is not configured',
        undefined,
        'auth',
      )
    }

    const body = this.buildRequestBody(req)
    const url = `${this.baseURL}/models/${req.model}:generateContent?key=${this.apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      await this.handleError(response)
    }

    const data = (await response.json()) as Record<string, unknown>
    return this.mapResponse(req.model, data)
  }

  override async *stream(
    req: CompletionRequest,
  ): AsyncIterable<CompletionChunk> {
    if (!this.apiKey) {
      throw new ProviderError(
        'GOOGLE_API_KEY is not configured',
        undefined,
        'auth',
      )
    }

    const body = this.buildRequestBody(req)
    const url = `${this.baseURL}/models/${req.model}:streamGenerateContent?alt=sse&key=${this.apiKey}`

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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

  private buildRequestBody(req: CompletionRequest): Record<string, unknown> {
    const { system, chatMessages } = this.extractSystemMessage(req.messages)

    const contents = chatMessages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: this.mapContentToParts(m.content),
    }))

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {} as Record<string, unknown>,
    }

    if (system) {
      body.systemInstruction = {
        parts: [{ text: system }],
      }
    }

    const gc = body.generationConfig as Record<string, unknown>
    if (req.temperature !== undefined) {
      gc.temperature = req.temperature
    } else if (this.defaults?.temperature !== undefined) {
      gc.temperature = this.defaults.temperature
    }
    if (req.maxTokens !== undefined) {
      gc.maxOutputTokens = req.maxTokens
    } else if (this.defaults?.maxTokens !== undefined) {
      gc.maxOutputTokens = this.defaults.maxTokens
    }
    if (req.stop !== undefined) {
      gc.stopSequences = this.normalizeStop(req.stop)
    }

    return body
  }

  private mapContentToParts(
    content: string | { type: string; text?: string }[],
  ): Array<{ text: string }> {
    if (typeof content === 'string') {
      return [{ text: content }]
    }
    return content
      .filter(p => p.type === 'text')
      .map(p => ({ text: p.text ?? '' }))
  }

  private mapResponse(
    model: string,
    data: Record<string, unknown>,
  ): CompletionResponse {
    const candidates = data.candidates as
      | Array<Record<string, unknown>>
      | undefined

    if (!candidates || candidates.length === 0) {
      const blockReason = data.promptFeedback as Record<string, unknown> | undefined
      const blockReasonStr = blockReason?.blockReason as string | undefined
      throw new ProviderError(
        `No candidates returned${blockReasonStr ? `: blocked due to ${blockReasonStr}` : ''}`,
        0,
        'server_error',
      )
    }

    const usageData = data.usageMetadata as Record<string, number> | undefined

    const choices = candidates.map((c, i) => {
      const content = c.content as Record<string, unknown> | undefined
      const parts = content?.parts as Array<Record<string, unknown>> | undefined
      const text = parts
        ? parts
            .filter(p => p.text !== undefined)
            .map(p => p.text as string)
            .join('')
        : ''
      return {
        index: i,
        message: {
          role: 'assistant' as const,
          content: text,
        },
        finishReason: this.mapFinishReason(
          c.finishReason as string | undefined,
        ),
      }
    })

    const result: CompletionResponse = {
      id: `gemini-${Date.now()}`,
      model,
      choices,
    }

    if (usageData) {
      result.usage = {
        promptTokens: usageData.promptTokenCount ?? 0,
        completionTokens: usageData.candidatesTokenCount ?? 0,
        totalTokens: usageData.totalTokenCount ?? 0,
      }
    }

    return result
  }

  private mapStreamChunk(
    event: SSEEvent,
  ): CompletionChunk | undefined {
    const data = event.data
    const candidates = data.candidates as
      | Array<Record<string, unknown>>
      | undefined

    if (!candidates || candidates.length === 0) return undefined

    const choices = candidates.map((c, i) => {
      const content = c.content as Record<string, unknown> | undefined
      const parts = content?.parts as Array<Record<string, unknown>> | undefined
      const text = parts
        ? parts
            .filter(p => p.text !== undefined)
            .map(p => p.text as string)
            .join('')
        : undefined

      return {
        index: i,
        delta: text ? { content: text } : {},
        finishReason: this.mapFinishReason(
          c.finishReason as string | undefined,
        ),
      }
    })

    return this.makeCompletionChunk(
      `gemini-${Date.now()}`,
      data.model as string ?? 'gemini',
      choices,
    )
  }

  private mapFinishReason(
    reason: string | undefined,
  ): 'stop' | 'length' | null {
    if (!reason) return null
    if (reason === 'STOP') return 'stop'
    if (reason === 'MAX_TOKENS') return 'length'
    return null
  }
}
