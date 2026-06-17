# Setup

## Prerequisites

| Tool | Min Version |
|------|-------------|
| Node.js | 18.x (20.x LTS recommended) |
| npm | 9.x |
| Git | 2.x |
| Ollama (optional) | Latest |
| Redis (optional) | 7.x |

## Install

```bash
git clone https://github.com/anomalyco/chakravyuh-ai.git
cd chakravyuh-ai
npm install
```

## Configure

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# At least one provider key required
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
DEEPSEEK_API_KEY=...

# Optional
GITHUB_TOKEN=ghp_...
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://user:pass@localhost:5432/chakravyuh
OLLAMA_URL=http://localhost:11434
PORT=3000
LOG_LEVEL=info
```

## Provider Config

```yaml
# config/providers.yaml
providers:
  openai:
    models: [gpt-4o, gpt-4o-mini]
    defaults: { temperature: 0.7, maxTokens: 4096 }
  anthropic:
    models: [claude-sonnet-4-20250514, claude-3-5-haiku]
    defaults: { maxTokens: 8192 }
  ollama:
    url: http://localhost:11434
    models: [llama3.1:8b, mistral:7b]
```

## Agent Config

```yaml
# config/agents.yaml
agents:
  coder:
    provider: openai
    model: gpt-4o
    tools: [filesystem, github]
  browser:
    provider: anthropic
    model: claude-sonnet-4-20250514
    tools: [browser, web-fetch]
  researcher:
    provider: google
    model: gemini-2.5-pro
    tools: [web-fetch, web-search]
```

## MCP Config

```yaml
# config/mcp.yaml
servers:
  filesystem:
    enabled: true
    autoStart: true
    allowedDirectories: ["./workspace"]
  github:
    enabled: true
    autoStart: false
  browser:
    enabled: false
```

## Run

```bash
npm run dev              # dev mode with hot reload
npm run build && npm start  # production
```

## Docker

```bash
docker build -t chakravyuh-ai .
docker run -d --name chakravyuh -p 3000:3000 --env-file .env chakravyuh-ai
```

### Docker Compose

```yaml
services:
  chakravyuh:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    volumes: [./config:/app/config, ./workspace:/app/workspace]
    depends_on: [redis, postgres]
  redis:
    image: redis:7-alpine
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: chakravyuh
      POSTGRES_USER: chakravyuh
      POSTGRES_PASSWORD: changeme
```

## API

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Health check |
| `POST` | `/api/v1/chat` | Send message to agent |
| `POST` | `/api/v1/execute` | Execute workflow |
| `GET` | `/api/v1/agents` | List agents |
| `GET` | `/api/v1/mcp` | List MCP servers |
| `GET` | `/api/v1/memory` | Query memory |

## CLI

```bash
chakravyuh agent list
chakravyuh run "summarize commits"
chakravyuh mcp start github
chakravyuh logs --tail --agent coder
chakravyuh config show
```

## Verify

```bash
npm run build
npm test
```

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Provider not configured` | Set API key in `.env` |
| `MCP server not found` | Install MCP server package |
| `Ollama connection refused` | Run `ollama serve` |
| `Memory backend error` | Check Redis/PostgreSQL is running |
| `Build failed` | `npm run clean && npm install && npm run build` |
