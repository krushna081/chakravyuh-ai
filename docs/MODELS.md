# Models & Providers

Chakravyuh AI provides a **unified interface** over 8+ AI providers. Users connect their own API keys, and the capability router automatically selects the optimal model for each task.

---

## Provider Interface

All providers implement a common interface:

```typescript
interface LLMProvider {
  id: string
  name: string
  models: ModelInfo[]
  complete(req: CompletionRequest): Promise<CompletionResponse>
  stream?(req: CompletionRequest): AsyncIterable<CompletionChunk>
  embed?(input: string[]): Promise<number[][]>
}

interface ModelInfo {
  id: string
  context: number
  capabilities: ModelCapability[]
  cost: { input: number; output: number }
}

type ModelCapability = 'chat' | 'code' | 'vision' | 'reasoning' | 'audio' | 'embedding'
```

---

## Provider Catalog

### OpenAI

| Model | Context | Input $/1M | Output $/1M | Capabilities |
|-------|---------|------------|-------------|--------------|
| `gpt-4o` | 128K | 2.50 | 10.00 | chat, code, vision, reasoning |
| `gpt-4o-mini` | 128K | 0.15 | 0.60 | chat, code, vision |
| `o1` | 200K | 15.00 | 60.00 | chat, code, reasoning |
| `o1-mini` | 128K | 1.10 | 4.40 | chat, code, reasoning |
| `gpt-4-turbo` | 128K | 10.00 | 30.00 | chat, code, vision |
| `text-embedding-3-small` | — | 0.02 | — | embedding |
| `text-embedding-3-large` | — | 0.13 | — | embedding |

```json
{ "provider": "openai", "model": "gpt-4o", "temperature": 0.7, "maxTokens": 4096 }
```

### Anthropic

| Model | Context | Input $/1M | Output $/1M | Capabilities |
|-------|---------|------------|-------------|--------------|
| `claude-sonnet-4-20250514` | 200K | 3.00 | 15.00 | chat, code, vision, reasoning |
| `claude-3-5-sonnet-20241022` | 200K | 3.00 | 15.00 | chat, code, vision |
| `claude-3-5-haiku-20241022` | 200K | 0.80 | 4.00 | chat, code |
| `claude-3-opus-20240229` | 200K | 15.00 | 75.00 | chat, code, vision, reasoning |

```json
{ "provider": "anthropic", "model": "claude-sonnet-4-20250514", "maxTokens": 8192 }
```

### Google Gemini

| Model | Context | Input $/1M | Output $/1M | Capabilities |
|-------|---------|------------|-------------|--------------|
| `gemini-2.5-pro-exp-03-25` | 1M+ | 1.25 | 5.00 | chat, code, vision, reasoning, audio |
| `gemini-2.0-flash` | 1M | 0.10 | 0.40 | chat, code, vision, audio |
| `gemini-2.0-flash-lite` | 1M | 0.075 | 0.30 | chat, code |
| `text-embedding-004` | — | 0.0001 | — | embedding |

```json
{ "provider": "google", "model": "gemini-2.5-pro-exp-03-25", "maxOutputTokens": 8192 }
```

### DeepSeek

| Model | Context | Input $/1M | Output $/1M | Capabilities |
|-------|---------|------------|-------------|--------------|
| `deepseek-chat` | 128K | 0.14 | 0.28 | chat, code |
| `deepseek-coder` | 128K | 0.14 | 0.28 | code |
| `deepseek-reasoner` | 128K | 0.55 | 2.19 | chat, reasoning |

```json
{ "provider": "deepseek", "model": "deepseek-chat", "temperature": 0.7 }
```

### Grok (xAI)

| Model | Context | Input $/1M | Output $/1M | Capabilities |
|-------|---------|------------|-------------|--------------|
| `grok-2` | 131K | 2.00 | 10.00 | chat, code, vision |
| `grok-2-mini` | 131K | 0.30 | 1.50 | chat, code |

```json
{ "provider": "grok", "model": "grok-2", "temperature": 0.7 }
```

### OpenRouter

OpenRouter provides access to 200+ models through a single API. Chakravyuh dynamically fetches available models at startup.

```json
{
  "provider": "openrouter",
  "model": "anthropic/claude-sonnet-4",
  "baseUrl": "https://openrouter.ai/api/v1"
}
```

### Ollama (Local)

| Model | Size | Parameters | Capabilities | Use Case |
|-------|------|------------|--------------|----------|
| `llama3.1` | 8B | 8B | chat, code | General purpose |
| `llama3.1` | 70B | 70B | chat, code, reasoning | Complex tasks |
| `mistral` | 7B | 7B | chat, code | Fast inference |
| `mixtral` | 8x7B | 47B | chat, code | Quality |
| `codellama` | 34B | 34B | code | Code generation |
| `phi3` | 14B | 14B | chat, code | Lightweight |
| `qwen2.5` | 7B | 7B | chat, code | Multilingual |
| `nomic-embed-text` | — | — | embedding | Embeddings |
| `llava` | 13B | 13B | vision | Image analysis |
| `deepseek-coder` | 6.7B | 6.7B | code | Code specialized |

```json
{
  "provider": "ollama",
  "baseUrl": "http://localhost:11434",
  "model": "llama3.1:8b"
}
```

---

## Capability Routing Matrix

The capability router matches tasks to the optimal provider based on required capabilities, cost, and availability.

| Task Type | Required Capability | Recommended Provider(s) | Fallback |
|-----------|-------------------|------------------------|----------|
| Casual chat | chat | GPT-4o mini, Haiku, Gemini Flash | Any available |
| Complex reasoning | reasoning | o1, Sonnet 4, Gemini Pro | DeepSeek Reasoner |
| Code generation | code | GPT-4o, Sonnet 4, DeepSeek Coder | Codellama (local) |
| Code review | code | Sonnet 4, GPT-4o | DeepSeek Coder |
| Web research | reasoning | Gemini Pro (1M ctx), GPT-4o | Sonnet 4 |
| Browser automation | vision | Sonnet 4, GPT-4o | Gemini Flash |
| Image analysis | vision | GPT-4o, Sonnet 4 | Gemini Pro |
| Audio processing | audio | Gemini Flash, Gemini Pro | — |
| Embeddings | embedding | text-embedding-3-small, nomic | Gemini embedding |
| Budget-sensitive | chat | GPT-4o mini, Haiku, Gemini Flash | DeepSeek Chat |
| Offline / private | — | Ollama (any local model) | — |

---

## Routing Strategies

### Static

Fixed provider and model for an agent.

```json
{ "agent": "coder", "provider": "openai", "model": "gpt-4o" }
```

### Fallback Chain

Primary provider with automatic fallback on failure.

```json
{
  "strategy": "fallback",
  "providers": ["openai", "anthropic", "google"],
  "models": ["gpt-4o", "claude-sonnet-4-20250514", "gemini-2.5-pro-exp-03-25"],
  "onFailure": "notify_admin"
}
```

### Capability-Aware

Selects the cheapest model that meets minimum capability requirements.

```json
{
  "strategy": "capability",
  "minCapability": "code",
  "prefer": ["anthropic", "openai"],
  "maxCost": 0.50
}
```

### Cheapest

Always selects the lowest-cost model capable of the task.

```json
{
  "strategy": "cheapest",
  "minCapability": "reasoning",
  "maxLatencyMs": 5000
}
```

### Fastest

Selects the model with lowest expected latency.

```json
{
  "strategy": "fastest",
  "minCapability": "chat",
  "providers": ["openai", "anthropic"]
}
```

### Ensemble

Queries multiple providers and aggregates results.

```json
{
  "strategy": "ensemble",
  "providers": ["openai", "anthropic", "deepseek"],
  "models": ["gpt-4o", "claude-sonnet-4-20250514", "deepseek-chat"],
  "aggregator": "majority",
  "requireConsensus": false
}
```

### Cost-Aware

Intelligent routing within a monthly budget.

```json
{
  "strategy": "cost-aware",
  "monthlyBudget": 100.00,
  "remainingBudget": 42.50,
  "preferredProvider": "openai",
  "budgetProvider": "deepseek",
  "budgetThreshold": 20.00
}
```

---

## Rate Limiting & Budgets

```yaml
rate_limits:
  global:
    requestsPerMinute: 100
    tokensPerMinute: 500000
    maxConcurrent: 10

  per_provider:
    openai:
      requestsPerMinute: 60
      tokensPerMinute: 100000
      maxConcurrent: 5
    anthropic:
      requestsPerMinute: 50
      tokensPerMinute: 80000
      maxConcurrent: 4

  per_agent:
    coder:
      requestsPerMinute: 30
      tokensPerMinute: 50000

budgets:
  monthly:
    openai: 100.00
    anthropic: 100.00
    google: 50.00
  alerts:
    - threshold: 80%
      action: notify_admin
    - threshold: 100%
      action: switch_to_budget_provider
```

---

## Provider Configuration

### Environment Variables

```bash
# Required (at least one)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
DEEPSEEK_API_KEY=...
GROK_API_KEY=...
OPENROUTER_API_KEY=...

# Optional
OLLAMA_URL=http://localhost:11434
GITHUB_TOKEN=ghp_...
```

### YAML Config

```yaml
# config/providers.yaml
providers:
  openai:
    enabled: true
    priority: 1
    models: [gpt-4o, gpt-4o-mini]
    defaults: { temperature: 0.7, maxTokens: 4096 }

  anthropic:
    enabled: true
    priority: 2
    models: [claude-sonnet-4-20250514, claude-3-5-haiku]
    defaults: { maxTokens: 8192 }

  ollama:
    enabled: true
    url: http://localhost:11434
    models:
      - id: llama3.1:8b
        capabilities: [chat, code]
```

---

## Provider Comparison

| Feature | OpenAI | Anthropic | Google | DeepSeek | Ollama |
|---------|--------|-----------|--------|----------|--------|
| Max Context | 200K | 200K | 1M+ | 128K | Variable |
| Vision | ✅ | ✅ | ✅ | ❌ | ✅ (llava) |
| Reasoning | ✅ (o1) | ✅ (Sonnet) | ✅ (Pro) | ✅ (Reasoner) | ❌ |
| Audio | ❌ | ❌ | ✅ | ❌ | ❌ |
| Embeddings | ✅ | ❌ | ✅ | ❌ | ✅ |
| Streaming | ✅ | ✅ | ✅ | ✅ | ✅ |
| Function Calling | ✅ | ✅ (tools) | ✅ | ✅ | ❌ |
| Free Tier | ❌ | ❌ | ✅ (limited) | ❌ | ✅ |
| Offline | ❌ | ❌ | ❌ | ❌ | ✅ |
| Cost (cheapest) | $0.15/M | $0.80/M | $0.075/M | $0.14/M | $0 |
