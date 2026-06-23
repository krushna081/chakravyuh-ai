import {
  type CompletionRequest,
  type CompletionResponse,
  type CompletionChunk,
  type ProviderConfig,
  ProviderError,
} from '../../types.js'
import { BaseProvider } from '../base.js'

export class OllamaProvider extends BaseProvider {
  id = 'ollama'
  name = 'Ollama'

  constructor(config: ProviderConfig) {
    super(config, 'OLLAMA_URL', 'http://localhost:11434')
  }

  protected override async executeComplete(
    req: CompletionRequest,
  ): Promise<CompletionResponse> {
    const body = this.buildRequestBody(req, false)

    const response = await fetch(`${this.baseURL}/api/chat`, {
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
    const body = this.buildRequestBody(req, true)

    const response = await fetch(`${this.baseURL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      await this.handleError(response)
    }

    for await (const data of this.parseNDJSON(response)) {
      const chunk = this.mapStreamChunk(req.model, data)
      if (chunk) yield chunk
      if (data.done === true) return
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
        content: this.extractTextContent(m.content),
      })),
      stream,
      options: {} as Record<string, unknown>,
    }

    const opts = body.options as Record<string, unknown>
    if (req.temperature !== undefined) {
      opts.temperature = req.temperature
    } else if (this.defaults?.temperature !== undefined) {
      opts.temperature = this.defaults.temperature
    }
    if (req.maxTokens !== undefined) {
      opts.num_predict = req.maxTokens
    } else if (this.defaults?.maxTokens !== undefined) {
      opts.num_predict = this.defaults.maxTokens
    }
    if (req.stop !== undefined) {
      opts.stop = this.normalizeStop(req.stop)
    }

    return body
  }

  private mapResponse(
    model: string,
    data: Record<string, unknown>,
  ): CompletionResponse {
    const messageData = data.message as Record<string, unknown> | undefined
    const content = (messageData?.content as string) ?? ''

    const result: CompletionResponse = {
      id: `ollama-${Date.now()}`,
      model,
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finishReason: data.done === true ? 'stop' : null,
        },
      ],
    }

    const promptTokens = (data.prompt_eval_count as number) ?? 0
    const completionTokens = (data.eval_count as number) ?? 0

    if (promptTokens > 0 || completionTokens > 0) {
      result.usage = {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      }
    }

    return result
  }

  private mapStreamChunk(
    model: string,
    data: Record<string, unknown>,
  ): CompletionChunk | undefined {
    const messageData = data.message as Record<string, unknown> | undefined
    const content = messageData?.content as string | undefined

    if (!content && data.done !== true) return undefined

    return this.makeCompletionChunk(`ollama-${Date.now()}`, model, [
      {
        index: 0,
        delta: content ? { content } : {},
        finishReason: data.done === true ? 'stop' : null,
      },
    ])
  }
}
