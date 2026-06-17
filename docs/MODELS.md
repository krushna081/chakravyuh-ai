# Models

## Provider Interface

All providers implement:

```typescript
export interface LLMProvider {
  id: string
  name: string
  models: string[]
  complete(req: CompletionRequest): Promise<CompletionResponse>
  stream?(req: CompletionRequest): AsyncIterable<CompletionChunk>
  embed?(input: string[]): Promise<number[][]>
}
```

## OpenAI

| Model | Context | Input $/1M | Output $/1M |
|-------|---------|------------|-------------|
| `gpt-4o` | 128K | 2.50 | 10.00 |
| `gpt-4o-mini` | 128K | 0.15 | 0.60 |
| `o1` | 200K | 15.00 | 60.00 |
| `o1-mini` | 128K | 1.10 | 4.40 |
| `gpt-4-turbo` | 128K | 10.00 | 30.00 |
| `text-embedding-3-small` | — | 0.02 | — |
| `text-embedding-3-large` | — | 0.13 | — |

```json
{ "provider": "openai", "model": "gpt-4o", "temperature": 0.7, "maxTokens": 4096 }
```

## Anthropic

| Model | Context | Input $/1M | Output $/1M |
|-------|---------|------------|-------------|
| `claude-sonnet-4-20250514` | 200K | 3.00 | 15.00 |
| `claude-3-5-sonnet-20241022` | 200K | 3.00 | 15.00 |
| `claude-3-5-haiku-20241022` | 200K | 0.80 | 4.00 |
| `claude-3-opus-20240229` | 200K | 15.00 | 75.00 |

```json
{ "provider": "anthropic", "model": "claude-sonnet-4-20250514", "maxTokens": 8192 }
```

## Google Gemini

| Model | Context | Input $/1M | Output $/1M |
|-------|---------|------------|-------------|
| `gemini-2.5-pro-exp-03-25` | 1M+ | 1.25 | 5.00 |
| `gemini-2.0-flash` | 1M | 0.10 | 0.40 |
| `gemini-2.0-flash-lite` | 1M | 0.075 | 0.30 |
| `text-embedding-004` | — | 0.0001 | — |

```json
{ "provider": "google", "model": "gemini-2.5-pro-exp-03-25", "maxOutputTokens": 8192 }
```

## DeepSeek

| Model | Context | Input $/1M | Output $/1M |
|-------|---------|------------|-------------|
| `deepseek-chat` | 128K | 0.14 | 0.28 |
| `deepseek-coder` | 128K | 0.14 | 0.28 |
| `deepseek-reasoner` | 128K | 0.55 | 2.19 |

```json
{ "provider": "deepseek", "model": "deepseek-chat", "temperature": 0.7 }
```

## Ollama (Local)

| Model | Size | Use Case |
|-------|------|----------|
| `llama3.1:8b` | 8B | General |
| `llama3.1:70b` | 70B | Complex |
| `mistral:7b` | 7B | Fast |
| `mixtral:8x7b` | 47B | Quality |
| `codellama:34b` | 34B | Code |
| `phi3:14b` | 14B | Lightweight |
| `qwen2.5:7b` | 7B | Multilingual |
| `nomic-embed-text` | — | Embeddings |

```json
{ "provider": "ollama", "baseUrl": "http://localhost:11434", "model": "llama3.1:8b" }
```

## Provider Selection

### Static
```json
{ "agent": "coder", "provider": "openai", "model": "gpt-4o" }
```

### Fallback
```json
{ "strategy": "fallback", "providers": ["openai", "anthropic", "google"] }
```

### Cheapest
```json
{ "strategy": "cheapest", "minCapability": "high" }
```

### Ensemble
```json
{ "strategy": "ensemble", "providers": ["openai", "anthropic", "deepseek"], "aggregator": "majority" }
```

## Rate Limiting

```json
{
  "provider": "openai",
  "rateLimit": { "requestsPerMinute": 60, "tokensPerMinute": 100000, "maxConcurrent": 5 },
  "budget": { "monthlyLimit": 100.00, "alertAt": 80.00 }
}
```
