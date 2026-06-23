import {
  type CompletionRequest,
  type CompletionResponse,
  type CompletionChunk,
  type ChunkChoice,
  type LLMProvider,
  type Message,
  type ModelInfo,
  type ProviderConfig,
  ProviderError,
} from '../types.js'

type StreamReader = {
  read(): Promise<{ done: boolean; value: Uint8Array }>
  cancel(reason?: unknown): Promise<void>
}

export interface SSEEvent {
  event?: string
  data: Record<string, unknown>
}

export abstract class BaseProvider implements LLMProvider {
  abstract id: string
  abstract name: string

  models: ModelInfo[]
  protected apiKey: string | undefined
  protected baseURL: string
  protected defaults: ProviderConfig['defaults']

  constructor(
    config: ProviderConfig,
    apiKeyEnvVar: string,
    defaultBaseURL: string,
  ) {
    this.models = config.models
    this.baseURL = config.baseUrl ?? defaultBaseURL
    const key = process.env[apiKeyEnvVar]
    this.apiKey = (key && key.trim()) ? key : undefined
    this.defaults = config.defaults
  }

  protected abstract executeComplete(
    req: CompletionRequest,
  ): Promise<CompletionResponse>

  async complete(req: CompletionRequest): Promise<CompletionResponse> {
    const maxRetries = 3
    let lastError: Error | undefined

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.executeCompleteWithTimeout(req)
      } catch (err) {
        lastError = err as Error
        if (
          err instanceof ProviderError &&
          err.code === 'rate_limit' &&
          attempt < maxRetries - 1
        ) {
          await this.delay(attempt)
          continue
        }
        throw err
      }
    }

    throw lastError!
  }

  async *stream(_req: CompletionRequest): AsyncIterable<CompletionChunk> {
    throw new ProviderError(
      `Streaming is not supported by ${this.id}`,
      undefined,
      'bad_request',
    )
  }

  async embed(_input: string[]): Promise<number[][]> {
    throw new ProviderError(
      `Embeddings are not supported by ${this.id}`,
      undefined,
      'bad_request',
    )
  }

  protected async executeCompleteWithTimeout(
    req: CompletionRequest,
    timeoutMs = 60000,
  ): Promise<CompletionResponse> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      return await this.executeComplete(req)
    } finally {
      clearTimeout(timeoutId)
    }
  }

  protected async delay(attempt: number): Promise<void> {
    const baseDelay = 1000
    const maxDelay = 16000
    const delayMs = Math.min(baseDelay * Math.pow(2, attempt), maxDelay)
    const jitter = Math.random() * 500
    await new Promise(resolve => setTimeout(resolve, delayMs + jitter))
  }

  protected async handleError(response: Response): Promise<never> {
    let errorBody: { error?: { message?: string } } | undefined
    try {
      errorBody = (await response.json()) as {
        error?: { message?: string }
      }
    } catch {
      // response body is not JSON
    }

    const message = errorBody?.error?.message ?? response.statusText
    const status = response.status

    if (status === 429) {
      throw new ProviderError(
        `Rate limit exceeded for ${this.id}: ${message}`,
        status,
        'rate_limit',
      )
    }
    if (status === 401 || status === 403) {
      throw new ProviderError(
        `Authentication error for ${this.id}: ${message}`,
        status,
        'auth',
      )
    }
    if (status >= 500) {
      throw new ProviderError(
        `Server error for ${this.id}: ${message}`,
        status,
        'server_error',
      )
    }
    throw new ProviderError(
      `Request failed for ${this.id}: ${message}`,
      status,
      'bad_request',
    )
  }

  protected async *parseSSEEvents(
    response: Response,
  ): AsyncGenerator<SSEEvent> {
    if (!response.body) {
      throw new ProviderError('No response body', 0, 'server_error')
    }

    const reader = response.body.getReader() as unknown as StreamReader
    const decoder = new TextDecoder()
    let buffer = ''
    let currentEvent: string | undefined

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          // process remaining buffer
          if (buffer.trim()) {
            const event = this.tryParseSSELine(buffer.trim(), currentEvent)
            if (event) yield event
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n')
        buffer = parts.pop() ?? ''

        for (const rawLine of parts) {
          const line = rawLine.trimEnd()
          if (!line) {
            currentEvent = undefined
            continue
          }
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim()
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            if (!dataStr || dataStr === '[DONE]') {
              currentEvent = undefined
              continue
            }
            try {
              const parsed = JSON.parse(dataStr) as Record<string, unknown>
              yield { event: currentEvent, data: parsed }
            } catch {
              // skip unparseable data lines
            }
            currentEvent = undefined
          }
        }
      }
    } finally {
      try {
        await reader.cancel()
      } catch {
        // stream may already be closed
      }
    }
  }

  protected async *parseNDJSON(
    response: Response,
  ): AsyncGenerator<Record<string, unknown>> {
    if (!response.body) {
      throw new ProviderError('No response body', 0, 'server_error')
    }

    const reader = response.body.getReader() as unknown as StreamReader
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          if (buffer.trim()) {
            const parsed = this.tryParseJSON(buffer.trim())
            if (parsed) yield parsed
          }
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const rawLine of lines) {
          const line = rawLine.trim()
          if (!line) continue
          const parsed = this.tryParseJSON(line)
          if (parsed) yield parsed
        }
      }
    } finally {
      try {
        await reader.cancel()
      } catch {
        // stream may already be closed
      }
    }
  }

  protected normalizeStop(stop?: string | string[]): string[] | undefined {
    if (!stop) return undefined
    if (typeof stop === 'string') return [stop]
    return stop
  }

  protected extractSystemMessage(
    messages: Message[],
  ): { system?: string; chatMessages: Message[] } {
    const systemParts: string[] = []
    const chatMessages: Message[] = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        const text =
          typeof msg.content === 'string'
            ? msg.content
            : msg.content
                .filter(p => p.type === 'text')
                .map(p => p.text)
                .join('\n')
        if (text) systemParts.push(text)
      } else {
        chatMessages.push(msg)
      }
    }

    return {
      system: systemParts.length > 0 ? systemParts.join('\n') : undefined,
      chatMessages,
    }
  }

  protected serializeContent(
    content: string | { type: string; text?: string; image_url?: { url: string } }[],
  ):
    | string
    | { type: string; text?: string; image_url?: { url: string } }[] {
    if (typeof content === 'string') return content
    return content.map(part => ({
      type: part.type,
      text: part.text,
      image_url: part.image_url,
    }))
  }

  protected extractTextContent(content: string | { type: string; text?: string }[]): string {
    if (typeof content === 'string') return content
    return content
      .filter(p => p.type === 'text')
      .map(p => p.text)
      .join('\n')
  }

  protected makeCompletionChunk(
    id: string,
    model: string,
    choices: ChunkChoice[],
  ): CompletionChunk {
    return { id, model, choices }
  }

  private tryParseSSELine(
    line: string,
    currentEvent: string | undefined,
  ): SSEEvent | undefined {
    const trimmed = line.trim()
    if (trimmed.startsWith('data: ')) {
      const dataStr = trimmed.slice(6).trim()
      if (dataStr && dataStr !== '[DONE]') {
        try {
          return {
            event: currentEvent,
            data: JSON.parse(dataStr) as Record<string, unknown>,
          }
        } catch {
          // unparseable
        }
      }
    }
    return undefined
  }

  private tryParseJSON(text: string): Record<string, unknown> | undefined {
    try {
      return JSON.parse(text) as Record<string, unknown>
    } catch {
      return undefined
    }
  }
}
