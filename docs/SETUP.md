# Setup

---

## Prerequisites

| Tool | Minimum | Recommended |
|------|---------|-------------|
| Node.js | 18.x | 20.x LTS |
| npm | 9.x | 10.x |
| Git | 2.x | 2.40+ |
| Ollama | Latest | Latest (for local models) |
| Redis | 7.x | 7.x (for working memory) |
| PostgreSQL | 15.x | 16.x (for episodic memory) |

---

## Quick Install

```bash
# Clone the repository
git clone https://github.com/anomalyco/chakravyuh-ai.git
cd chakravyuh-ai

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys

# Start development mode
npm run dev
```

---

## Configuration

### 1. Environment Variables

Copy `.env.example` to `.env` and configure at least one provider:

```bash
# At least one provider key required
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
DEEPSEEK_API_KEY=...

# Optional
GITHUB_TOKEN=ghp_...
REDIS_URL=redis://localhost:6379
DATABASE_URL=sqlite://memory/chakravyuh.db
OLLAMA_URL=http://localhost:11434
PORT=3000
LOG_LEVEL=info
```

### 2. Provider Configuration

Edit `config/providers.yaml` to enable/disable providers and configure models:

```yaml
providers:
  openai:
    enabled: true
    models: [gpt-4o, gpt-4o-mini]
    defaults: { temperature: 0.7, maxTokens: 4096 }

  anthropic:
    enabled: true
    models: [claude-sonnet-4-20250514, claude-3-5-haiku]
    defaults: { maxTokens: 8192 }

  ollama:
    enabled: false
    url: http://localhost:11434
    models: [llama3.1:8b, mistral:7b]
```

### 3. Agent Configuration

Edit `config/agents.yaml` to customize agent behavior:

```yaml
agents:
  coder:
    provider: openai
    model: gpt-4o
    tools: [filesystem, github]
    limits:
      maxTokensPerTask: 8192
      timeout: 120000

  researcher:
    provider: strategy
    strategy:
      type: capability
      minCapability: reasoning
      preferCheapest: true
    tools: [web-fetch, web-search]
```

### 4. MCP Server Configuration

Edit `config/mcp.yaml` to enable/disable MCP servers:

```yaml
servers:
  filesystem:
    enabled: true
    autoStart: true
    allowedDirectories: ["./workspace"]

  github:
    enabled: true
    autoStart: false
    env: { GITHUB_TOKEN: "${GITHUB_TOKEN}" }

  browser:
    enabled: false
```

---

## Running

### Development

```bash
npm run dev              # Hot-reload development mode
```

### Production

```bash
npm run build            # Compile TypeScript
npm start                # Start production server
```

### Docker

```bash
# Build image
docker build -t chakravyuh-ai .

# Run container
docker run -d \
  --name chakravyuh \
  -p 3000:3000 \
  --env-file .env \
  -v ./config:/app/config \
  -v ./workspace:/app/workspace \
  chakravyuh-ai
```

#### Docker Compose

```yaml
# docker-compose.yml
services:
  chakravyuh:
    build: .
    ports: ["3000:3000"]
    env_file: .env
    volumes:
      - ./config:/app/config
      - ./workspace:/app/workspace
    depends_on:
      redis:
        condition: service_started
      postgres:
        condition: service_healthy

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    volumes: [redis-data:/data]

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: chakravyuh
      POSTGRES_USER: chakravyuh
      POSTGRES_PASSWORD: changeme
    ports: ["5432:5432"]
    volumes: [postgres-data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chakravyuh"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  redis-data:
  postgres-data:
```

```bash
docker compose up -d
```

---

## Verification

```bash
# Check health endpoint
curl http://localhost:3000/api/v1/health

# List configured agents
curl http://localhost:3000/api/v1/agents

# Run a simple test
npm test
```

---

## CLI Reference

```bash
chakravyuh agent list                    # List all agents
chakravyuh agent status <id>             # Agent health status
chakravyuh run "summarize commits"       # Execute natural language task
chakravyuh mcp list                      # List MCP servers
chakravyuh mcp start <server>            # Start an MCP server
chakravyuh mcp stop <server>             # Stop an MCP server
chakravyuh logs --tail --agent coder     # Stream agent logs
chakravyuh config show                   # Show active configuration
chakravyuh config validate               # Validate config files
chakravyuh providers list                # List configured providers
chakravyuh models list                   # List available models
chakravyuh memory query "topic"          # Query memory
chakravyuh trace <traceId>               # View request trace
```

---

## API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | System health check |
| `POST` | `/api/v1/chat` | Send message to an agent |
| `POST` | `/api/v1/execute` | Execute a named workflow |
| `GET` | `/api/v1/agents` | List registered agents |
| `GET` | `/api/v1/agents/:id` | Agent details & health |
| `PUT` | `/api/v1/agents/:id/config` | Update agent config |
| `GET` | `/api/v1/providers` | List configured providers |
| `GET` | `/api/v1/models` | List available models per provider |
| `GET` | `/api/v1/mcp` | List MCP servers |
| `POST` | `/api/v1/mcp/:id/start` | Start an MCP server |
| `POST` | `/api/v1/mcp/:id/stop` | Stop an MCP server |
| `GET` | `/api/v1/memory` | Query memory store |
| `DELETE` | `/api/v1/memory/:id` | Delete memory entry |
| `GET` | `/api/v1/workflows` | List defined workflows |
| `GET` | `/api/v1/trace/:traceId` | View request trace |
| `GET` | `/api/v1/metrics` | Prometheus metrics |

---

## Troubleshooting

| Problem | Likely Cause | Solution |
|---------|-------------|----------|
| `Provider not configured` | Missing API key in `.env` | Add the required API key |
| `MCP server not found` | Package not installed | `npm install -g @modelcontextprotocol/server-*` |
| `Ollama connection refused` | Ollama not running | Run `ollama serve` |
| `Memory backend error` | Redis/PostgreSQL not running | Start the required service |
| `Build failed` | TypeScript/Lint errors | `npm run clean && npm install && npm run build` |
| `Rate limit exceeded` | Too many requests | Wait or increase rate limit config |
| `Agent timeout` | Task took too long | Increase `limits.timeout` in agent config |
| `No suitable model` | No provider has required capability | Enable another provider or adjust routing |

---

## Next Steps

- Read the [Architecture](ARCHITECTURE.md) guide
- Explore [Agent](AGENTS.md) types and create custom agents
- Configure [Providers](MODELS.md) and routing strategies
- Integrate [MCP Servers](MCP_SERVERS.md)
- Check the [Roadmap](../ROADMAP.md) for upcoming features
