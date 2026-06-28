<p align="center">
  <img src="https://img.shields.io/badge/Chakravyuh_AI-v0.2.0--alpha-8B5CF6?style=for-the-badge" alt="Chakravyuh AI" />
</p>

<p align="center">
  <strong>⚔ Multi-Agent AI Operating System</strong><br>
  <em>Ollama Cloud · Local GPU · Cloud APIs — no downloads required</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/version-0.2.0--alpha-orange?style=flat-square" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/python-3.11+-3776AB?style=flat-square" alt="Python"></a>
  <a href="#"><img src="https://img.shields.io/badge/ollama_cloud-ready-00D4AA?style=flat-square" alt="Ollama Cloud"></a>
  <a href="#"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome"></a>
  <a href="https://discord.gg/xGeeBAWDq"><img src="https://img.shields.io/badge/discord-join-5865F2?style=flat-square" alt="Discord"></a>
</p>

---

## Quick Start

**Zero local model downloads required** — use Ollama Cloud or your own API keys.

```bash
git clone https://github.com/krushna081/chakravyuh-ai.git
cd chakravyuh-ai

# Option A: Ollama Cloud (no GPU, no model downloads)
cp .env.example .env
# Edit .env: set OLLAMA_HOST=https://ollama.com and OLLAMA_API_KEY
python -m pip install -r requirements.txt
pip install -e .
cv setup --no-pull          # skip model pulling, use cloud models
cv run                      # start API + open dashboard

# Option B: Local Ollama (requires GPU + model downloads)
# cv setup                  # auto-detect, pull models

# Option C: Textual TUI (no browser needed)
cv tui                      # multi-pane terminal dashboard
```

> **No GPU?** Use **Option A** with Ollama Cloud — models run on Ollama's servers, you just need an API key from [ollama.com](https://ollama.com).  
> **Have GPU?** Use **Option B** with local Ollama for full privacy.

---

## What is Chakravyuh?

Chakravyuh AI is an **open-source, multi-agent AI operating system** — a **Control Agent** orchestrates 10 specialized agents (coder, researcher, planner, QA, security, and more) into a coordinated mesh that breaks down complex tasks and executes them autonomously.

| Capability | What it does |
|------------|--------------|
| **Control Agent** | Intelligent orchestrator that decomposes tasks, assigns subtasks, and monitors execution |
| **Agent Mesh** | 10 specialized agents collaborating on complex workflows |
| **Model Flexibility** | Ollama Cloud, local Ollama, OpenAI, Anthropic, DeepSeek, Google, Groq — or combine them |
| **Ollama Cloud** | Run cloud models via `OLLAMA_HOST=https://ollama.com` — no GPU or local downloads needed |
| **Model Router** | Three modes: `local` (Ollama only), `hybrid` (Ollama + cloud), `cloud` (always cloud providers) |
| **MCP Tools** | Filesystem, web fetch/search, GitHub, Docker, terminal integration |
| **Memory Tiers** | Working, episodic, semantic, procedural — SQLite + ChromaDB backends |
| **Terminal-First** | Rich CLI + Textual TUI — full control from the command line |
| **Web Dashboard** | Light-themed React + Vite UI for visual agent management |
| **Autonomous Workflows** | Multi-step execution with dependency tracking and error recovery |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│              CLI / TUI / Web Dashboard                        │
│   cv run │ cv tui │ cv chat │ cv status │ Web UI (React)     │
├──────────────────────────────────────────────────────────────┤
│                     FastAPI (api/)                             │
│     /api/v1/chat  /api/v1/agents  /api/v1/models              │
│     /api/v1/memory  /api/v1/status  /health                   │
├──────────────────────────────────────────────────────────────┤
│                   Control Agent (core/)                        │
│  Orchestrator → Event Bus → Agent Registry → Task Queue       │
├──────────────────────────────────────────────────────────────┤
│                   Agent Mesh (agents/)                         │
│ Coordinator │ Planner │ Coder │ Researcher │ Browser          │
│ QA │ Memory Agent │ Security │ GitHub │ Deployment            │
├──────────────────────────────────────────────────────────────┤
│                     Tools (tools/)                             │
│  MCP Client │ Filesystem │ Web Fetch │ Terminal │ GitHub      │
│  Web Search │ Docker                                           │
├──────────────────────────────────────────────────────────────┤
│                   Memory Layer (memory/)                        │
│  In-Memory │ SQLite │ ChromaDB (vector search)                │
├──────────────────────────────────────────────────────────────┤
│                   Providers / Models                            │
│  Ollama (local) │ Ollama Cloud │ OpenAI │ Anthropic            │
│  DeepSeek │ Google │ Groq │ OpenRouter                         │
└──────────────────────────────────────────────────────────────┘
```

### Key Features

| Feature | Description |
|---------|-------------|
| **Control Agent** | Central orchestrator — decomposes tasks, assigns to agents, monitors execution |
| **Unified Python Backend** | Single FastAPI server handles API, orchestrator, agents, memory |
| **Terminal-First** | `cv` commands for everything + Textual TUI for real-time monitoring |
| **Ollama Cloud Support** | Set `OLLAMA_HOST=https://ollama.com` — no local models needed |
| **10 Python Agents** | Each with isolated communication and tool access |
| **Memory Backends** | SQLite, ChromaDB, and in-memory — swap with env var |
| **Tool System** | Plugin-like tools (filesystem, web, GitHub, Docker, terminal) |

---

## CLI Commands

| Command | Description |
|---------|-------------|
| `cv setup` | One-command setup: install deps, pull models (optional), create .env |
| `cv run` | Start full system: API + dashboard |
| `cv status` | Show system status: Ollama, models, backend |
| `cv models` | List, pull, and manage models |
| `cv chat` | Interactive chat with any model |
| `cv tui` | Launch Textual multi-pane TUI dashboard |
| `cv term` | Manage per-agent terminals (spawn, send, attach) |
| `cv agents` | List and manage registered agents |
| `cv task` | Submit a task to the Control Agent |

---

## Configuration

Copy `.env.example` to `.env` and edit:

```ini
# ── Ollama Cloud (no GPU needed) ──
OLLAMA_HOST=https://ollama.com
OLLAMA_API_KEY=your_api_key_here

# ── Local Ollama (requires GPU) ──
# OLLAMA_HOST=http://127.0.0.1:11434

# ── Router Mode ──
CHAKRAVYUH_ROUTER_MODE=local   # local, hybrid, or cloud
```

---

## Docker Compose

```bash
# CPU only
docker compose -f docker/docker-compose.yml up -d

# NVIDIA GPU
$env:COMPOSE_FILE = "docker/docker-compose.yml;docker/docker-compose.gpu-nvidia.yml"
docker compose up -d

# AMD ROCm GPU
$env:COMPOSE_FILE = "docker/docker-compose.yml;docker/docker-compose.gpu-amd.yml"
docker compose up -d
```

The stack includes:
- **Chakravyuh AI** — Python backend on port 3001
- **Ollama** — Local LLM inference on port 11434
- **ChromaDB** — Vector store on port 8100

---

## Repository Structure

```
chakravyuh-ai/
├── cli/                  # Python CLI (Typer + Rich + Textual TUI)
│   ├── main.py           # Entrypoint: all cv commands
│   ├── ollama.py         # Ollama manager (local + cloud)
│   ├── config.py         # Pydantic config (.env)
│   ├── tui.py            # Textual multi-pane TUI
│   └── tui_app.py        # TUI application logic
├── core/                 # Core runtime
│   ├── types.py          # All type definitions
│   ├── event_bus.py      # Async pub/sub event system
│   ├── base_agent.py     # Abstract agent base class
│   ├── control_agent.py  # Central task orchestrator
│   ├── orchestrator.py   # System lifecycle manager
│   ├── terminal_manager.py # Per-agent PTY subprocess manager
│   └── prompt_engineer.py  # Task analysis + prompt crafting
├── agents/               # 10 specialized agents
│   ├── coordinator.py    # Agent mesh coordinator
│   ├── planner.py        # Task decomposition
│   ├── coder.py          # Code generation
│   ├── researcher.py     # Research & analysis
│   ├── browser.py        # Web browsing
│   ├── qa.py             # Quality assurance
│   ├── memory_agent.py   # Memory management
│   ├── security.py       # Security analysis
│   ├── github.py         # GitHub operations
│   └── deployment.py     # Deployment automation
├── api/                  # FastAPI backend
│   ├── app.py            # App factory + lifespan
│   └── routes/           # API route modules
├── tools/                # Tool system
│   ├── base.py           # Base tool class
│   ├── mcp_client.py     # MCP client
│   ├── filesystem.py     # Sandboxed filesystem
│   ├── web_fetch.py      # URL fetcher
│   ├── web_search.py     # DuckDuckGo search
│   ├── terminal.py       # Sandboxed shell
│   ├── github.py         # GitHub API
│   └── docker.py         # Docker API
├── memory/               # Memory backends
│   ├── interface.py      # Abstract memory interface
│   ├── in_memory.py      # In-memory backend
│   ├── sqlite_backend.py # SQLite backend
│   └── chroma_backend.py # ChromaDB vector backend
├── web/                  # React + Vite dashboard
├── docker/               # Docker support
├── index.html            # Marketing landing page
├── dashboard.html        # Live agent control center
├── .env.example          # Configuration template
├── pyproject.toml        # Python project config
└── requirements.txt      # Python dependencies
```

---

## Ollama Integration

Chakravyuh supports **two modes** for Ollama:

### Ollama Cloud (no GPU, no local downloads)
Set `OLLAMA_HOST=https://ollama.com` and provide your API key from [ollama.com](https://ollama.com). All inference runs on Ollama's cloud servers. Access models like `gpt-oss:120b-cloud`, `llama4:400b`, and hundreds more without downloading anything.

### Local Ollama (self-hosted, private)
Run `cv setup` to auto-detect Ollama and pull recommended models. Everything runs locally on your GPU.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

- **Branch strategy**: `feature/*` → `dev` → `main`
- **Stack**: Python (CLI/API/Agents/Tools) + React (Web)
- **Code style**: Ruff (Python) + Prettier (JS/TS)

---

## Community

- **Discord**: [Join the community](https://discord.gg/xGeeBAWDq)
- **GitHub Discussions**: [Ask questions, share ideas](https://github.com/krushna081/chakravyuh-ai/discussions)
- **Issues**: [Report bugs, request features](https://github.com/krushna081/chakravyuh-ai/issues)

---

## License

Apache 2.0 — see [LICENSE](LICENSE).

---

<p align="center">
  <sub>Built with ❤️ by <a href="http://krushna081.online/">krushna081</a> and contributors.</sub>
</p>
