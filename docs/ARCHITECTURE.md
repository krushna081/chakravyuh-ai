# Architecture

Chakravyuh AI uses a **layered microkernel architecture** with a central orchestrator, a mesh of specialized agents, an abstraction layer over AI providers, and a standardized protocol (MCP) for tool and data access.

---

## Layered Architecture

```mermaid
graph TB
    subgraph "Layer 1 — Interface"
        API[HTTP / WebSocket API]
        CLI[CLI]
        WEB[Web UI]
    end

    subgraph "Layer 2 — Orchestrator"
        ENGINE[Engine]
        ROUTER[Message Router]
        SCHED[Workflow Scheduler]
        REGISTRY[Agent Registry]
        MEM_MGR[Memory Manager]
        BUS[Event Bus]
        TASK_ANALYZER[Task Analyzer]
        CAP_ROUTER[Capability Router]
    end

    subgraph "Layer 3 — Agent Mesh"
        COORD[Coordinator]
        PLAN[Planner]
        CODER[Coder]
        RESEARCH[Researcher]
        BROWSER[Browser]
        QA[QA]
        MEM_AGENT[Memory Agent]
        SEC[Security Agent]
        GH[GitHub Agent]
        DEPLOY[Deployment Agent]
    end

    subgraph "Layer 4 — Provider Abstraction"
        OAI[OpenAI]
        ANTH[Anthropic]
        GEM[Gemini]
        DS[DeepSeek]
        GROK[Grok]
        OR[OpenRouter]
        OLL[Ollama]
    end

    subgraph "Layer 5 — MCP Servers"
        FS[FileSystem]
        GH_MCP[GitHub]
        BR[Browser]
        DB[Database]
        WEB[Web Fetch]
        TERM[Terminal]
        GMAIL[Gmail]
        DRIVE[Drive]
        CAL[Calendar]
    end

    subgraph "Layer 6 — Memory"
        WORK[Working - Redis]
        EPI[Episodic - SQLite]
        SEM[Semantic - Vector DB]
        PROC[Procedural - File System]
    end

    API & CLI & WEB --> ENGINE
    ENGINE --> TASK_ANALYZER
    TASK_ANALYZER --> CAP_ROUTER
    CAP_ROUTER --> COORD
    COORD --> PLAN & CODER & RESEARCH & BROWSER & QA & MEM_AGENT & SEC & GH & DEPLOY
    PLAN & CODER & RESEARCH & BROWSER & QA & MEM_AGENT & SEC & GH & DEPLOY --> OAI & ANTH & GEM & DS & GROK & OR & OLL
    OAI & ANTH & GEM & DS & GROK & OR & OLL --> FS & GH_MCP & BR & DB & WEB & TERM & GMAIL & DRIVE & CAL
    MEM_MGR --> WORK & EPI & SEM & PROC
    ENGINE --> ROUTER
    ENGINE --> SCHED
    ENGINE --> REGISTRY
    ENGINE --> MEM_MGR
    ROUTER --> COORD & PLAN & CODER & RESEARCH & BROWSER & QA & MEM_AGENT & SEC & GH & DEPLOY
```

---

## Core Components

### 1. Orchestrator Engine

The engine is the runtime heart of Chakravyuh. It manages the lifecycle of all subsystems — starting, stopping, and coordinating the router, scheduler, registry, memory manager, and event bus.

**Responsibilities:**
- Bootstrap and shutdown coordination
- Configuration loading and hot-reload
- Health monitoring and circuit breaking
- Graceful degradation on component failure

**Error handling:**
- **Provider failures**: Automatic fallback to next available provider
- **Agent timeouts**: Task re-queued or escalated to human-in-the-loop
- **MCP disconnections**: Automatic reconnection with exponential backoff
- **Memory backend down**: Degraded operation with in-memory fallback

### 2. Message Router

The router handles all inter-agent communication using a structured message protocol.

```typescript
interface AgentMessage {
  id: string
  from: string
  to: string | string[]
  type: 'request' | 'response' | 'broadcast' | 'error'
  priority: 'low' | 'medium' | 'high' | 'critical'
  payload: {
    task?: string
    data?: unknown
    context?: Record<string, unknown>
  }
  metadata: {
    timestamp: string
    ttl: number
    traceId: string
    parentId?: string
    correlationId?: string
  }
}
```

**Routing strategies:**
- **Direct**: Unicast to a specific agent
- **Multicast**: Send to a group of agents
- **Broadcast**: Send to all agents
- **Priority queue**: Critical messages bypass the FIFO queue

### 3. Task Analyzer

Every user request passes through the task analyzer before routing. It classifies the task and determines required capabilities.

```typescript
interface TaskAnalysis {
  type: 'code' | 'research' | 'browse' | 'plan' | 'test' | 'memory' | 'security' | 'deploy'
  complexity: 'simple' | 'moderate' | 'complex'
  requiredCapabilities: Array<'chat' | 'code' | 'vision' | 'reasoning' | 'audio'>
  estimatedTokens: number
  sensitivity: 'normal' | 'sensitive' | 'critical'
  timeout: number
}
```

### 4. Capability Router

The capability router dynamically selects the optimal provider and model for each task.

**Routing strategies:**

| Strategy | Description |
|----------|-------------|
| **Static** | Fixed provider/model per agent |
| **Fallback** | Primary provider → fallback chain |
| **Capability** | Min capability match, cheapest eligible |
| **Cheapest** | Lowest cost among capable models |
| **Fastest** | Lowest latency among capable models |
| **Ensemble** | Multiple providers, majority aggregation |
| **Cost-aware** | Within budget, best quality |

```typescript
interface RoutingDecision {
  provider: string
  model: string
  confidence: number
  estimatedCost: number
  estimatedLatencyMs: number
  alternatives: Array<{ provider: string; model: string }>
}
```

### 5. Agent Registry

Central registry for agent discovery, lifecycle, and health.

```typescript
interface AgentDefinition {
  id: string
  name: string
  role: string
  systemPrompt: string
  provider: string | RoutingStrategy
  model: string
  tools: string[]
  memoryScope: MemoryType[]
  allowedPeers: string[]
  limits: {
    maxTokensPerTask: number
    maxConsecutiveCalls: number
    timeout: number
  }
  health: {
    status: 'healthy' | 'degraded' | 'unhealthy'
    lastHeartbeat: string
    errorCount: number
  }
}
```

### 6. Workflow Scheduler

The scheduler executes declarative multi-step workflows defined in YAML.

```yaml
workflow:
  id: code-review-pipeline
  version: "1.0"
  description: "Review, test, and deploy a feature branch"
  maxRetries: 3
  onFailure: notify_human

  steps:
    - id: analyze
      agent: coder
      task: "Analyze PR #{{ pr_number }} for code quality"
      output: analysis

    - id: test
      agent: qa
      task: "Run tests on {{ steps.analysis.output }}"
      depends_on: [analyze]
      gates:
        - type: condition
          expression: "steps.analysis.status == 'pass'"

    - id: research
      agent: researcher
      task: "Research best practices for {{ steps.analysis.output.language }}"
      parallel: true
      depends_on: [analyze]

    - id: report
      agent: planner
      task: "Combine {{ steps.test.output }} and {{ steps.research.output }}"
      depends_on: [test, research]
      gates:
        - type: human_approval
          message: "Review combined report?"
```

---

## Data Flow

### Request Lifecycle

```mermaid
sequenceDiagram
    participant User
    participant API as API Gateway
    participant Engine as Orchestrator
    participant Analyzer as Task Analyzer
    participant Router as Capability Router
    participant Agent as Agent
    participant Provider as AI Provider
    participant MCP as MCP Server
    participant Mem as Memory

    User->>API: POST /api/v1/chat
    API->>Engine: Route request
    Engine->>Analyzer: Classify task
    Analyzer-->>Engine: TaskAnalysis
    Engine->>Router: Select agent & provider
    Router-->>Engine: RoutingDecision
    Engine->>Agent: Dispatch task
    Agent->>Provider: LLM completion
    Provider-->>Agent: Response
    Agent->>MCP: Tool call (if needed)
    MCP-->>Agent: Tool result
    Agent->>Mem: Store interaction
    Mem-->>Agent: Confirmation
    Agent-->>Engine: Task result
    Engine-->>API: Response
    API-->>User: Final output
```

### Error Flow

```mermaid
flowchart LR
    A[Request] --> B{Route OK?}
    B -->|Yes| C[Execute]
    B -->|No| D{Fallback available?}
    D -->|Yes| E[Next provider]
    E --> C
    D -->|No| F[Error response]
    C --> G{Agent success?}
    G -->|Yes| H[Return result]
    G -->|No| I{Retry?}
    I -->|Yes| C
    I -->|No| F
```

---

## Memory Architecture

```mermaid
graph TB
    subgraph "Memory Manager"
        MM[Memory Manager]
        CACHE[Write-Through Cache]
        SYNC[Sync Coordinator]
    end

    subgraph "Tiers"
        W[Working Memory<br/>Redis / In-Memory]
        E[Episodic Memory<br/>SQLite / PostgreSQL]
        S[Semantic Memory<br/>Vector DB]
        P[Procedural Memory<br/>File System]
    end

    subgraph "Properties"
        W1["TTL: session<br/>Access: O(1)<br/>Persistence: optional"]
        E1["TTL: 30d-90d<br/>Access: by conversation<br/>Schema: structured"]
        S1["TTL: permanent<br/>Access: similarity<br/>Schema: embeddings"]
        P1["TTL: permanent<br/>Access: by path<br/>Schema: markdown"]
    end

    MM --> W & E & S & P
    W --- W1
    E --- E1
    S --- S1
    P --- P1
```

| Tier | Storage | TTL | Query Type | Use Case |
|------|---------|-----|------------|----------|
| Working | Redis / In-Memory | Session | Key-value | Current conversation, state |
| Episodic | SQLite / PostgreSQL | 30–90 days | SQL | Conversation history |
| Semantic | Vector DB (pgvector, Qdrant, Pinecone) | Permanent | Similarity search | Knowledge, facts |
| Procedural | File System | Permanent | Path-based | Prompts, workflows, templates |

---

## MCP Integration Pattern

```mermaid
sequenceDiagram
    participant Agent
    participant MCPClient as MCP Client
    participant MCPServer as MCP Server
    participant External as External Service

    Agent->>MCPClient: callTool(name, args)
    MCPClient->>MCPServer: JSON-RPC request
    MCPServer->>External: API call / FS op
    External-->>MCPServer: Result
    MCPServer-->>MCPClient: JSON-RPC response
    MCPClient-->>Agent: ToolResult
```

---

## Security Architecture

```mermaid
graph TB
    subgraph "Security Layers"
        INPUT[Input Validation<br/>Zod schemas]
        INJECTION[Prompt Injection<br/>Detection]
        AUTH[Authentication<br/>JWT / API Keys]
        RATE[Rate Limiting<br/>Token Bucket]
        AUDIT[Audit Logging<br/>All actions]
        SANDBOX[Sandboxed<br/>Agent Contexts]
        APPROVAL[Approval Gates<br/>Human-in-the-Loop]
        REDACT[Secrets Redaction<br/>From logs]
    end

    INPUT --> INJECTION
    INJECTION --> AUTH
    AUTH --> RATE
    RATE --> AUDIT
    AUDIT --> SANDBOX
    SANDBOX --> APPROVAL
    APPROVAL --> REDACT
```

---

## Provider Abstraction

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
  rateLimit?: { rpm: number; tpm: number }
}

type ModelCapability = 'chat' | 'code' | 'vision' | 'reasoning' | 'audio' | 'embedding'
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | System health check |
| `POST` | `/api/v1/chat` | Send message to agent |
| `POST` | `/api/v1/execute` | Execute named workflow |
| `GET` | `/api/v1/agents` | List registered agents |
| `GET` | `/api/v1/agents/:id` | Agent details & health |
| `GET` | `/api/v1/providers` | List configured providers |
| `GET` | `/api/v1/models` | List available models |
| `GET` | `/api/v1/mcp` | List MCP servers |
| `POST` | `/api/v1/mcp/:id/start` | Start MCP server |
| `POST` | `/api/v1/mcp/:id/stop` | Stop MCP server |
| `GET` | `/api/v1/memory` | Query memory |
| `DELETE` | `/api/v1/memory/:id` | Delete memory entry |
| `GET` | `/api/v1/workflows` | List workflows |
| `GET` | `/api/v1/trace/:traceId` | Request trace |

---

## Directory Layout

```
chakravyuh-ai/
├── backend/
│   └── src/
│       ├── orchestrator/        # Engine, lifecycle, health
│       ├── router/              # Message router, dispatcher
│       ├── scheduler/           # Workflow parser, executor
│       ├── registry/            # Agent & service registry
│       ├── analyzer/            # Task classifier
│       ├── router/              # Capability router
│       ├── providers/           # Provider implementations
│       │   ├── openai/
│       │   ├── anthropic/
│       │   ├── google/
│       │   ├── deepseek/
│       │   ├── grok/
│       │   ├── openrouter/
│       │   └── ollama/
│       ├── memory/              # Memory interfaces
│       ├── mcp/                 # MCP client manager
│       ├── api/                 # HTTP/WS server
│       ├── events/              # Event bus
│       ├── security/            # Auth, audit, injection detection
│       └── config/              # Config loader
├── agents/                      # Agent definitions
│   ├── coordinator/
│   ├── planner/
│   ├── coder/
│   ├── researcher/
│   ├── browser/
│   ├── qa/
│   ├── memory/
│   ├── security/
│   ├── github/
│   └── deployment/
├── mcp/
│   ├── client/                  # MCP client SDK
│   └── servers/                 # Custom MCP server implementations
├── memory/
│   └── drivers/                 # Storage backend drivers
├── config/                      # Runtime YAML configs
├── scripts/                     # Dev, build, deploy scripts
├── prompts/                     # Agent system prompt templates
├── tests/                       # Test suites
├── examples/                    # Usage examples
└── docs/                        # Documentation
```
