<p align="center">
  <img src="https://img.shields.io/badge/Chakravyuh_AI-v0.2.0--alpha-8B5CF6?style=for-the-badge" alt="Chakravyuh AI" />
</p>

<p align="center">
  <strong>⚔ Multi-Agent AI Operating System</strong><br>
  <em>Local-first · Ollama-powered · Open-source</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/version-0.2.0--alpha-orange?style=flat-square" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/python-3.11+-3776AB?style=flat-square" alt="Python"></a>
  <a href="#"><img src="https://img.shields.io/badge/ollama-ready-00D4AA?style=flat-square" alt="Ollama"></a>
  <a href="#"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome"></a>
  <a href="https://discord.gg/xGeeBAWDq"><img src="https://img.shields.io/badge/discord-join-5865F2?style=flat-square" alt="Discord"></a>
</p>

---

## 🚀 Quick Start

**One command to run the full system:**

```bash
git clone https://github.com/krushna081/chakravyuh-ai.git
cd chakravyuh-ai

# Option A: Native (Python + Ollama)
python -m pip install -r requirements.txt
python -m cli setup      # auto-install deps, pull models, create .env
python -m cli run        # start Ollama + API server + open dashboard

# Option B: Docker (full stack)
docker compose up -d
```

> **Prerequisites:** [Ollama](https://ollama.com/download) + Python 3.11+ (native) or Docker (container).

---

## ✨ What is Chakravyuh?

Chakravyuh AI is an **open-source, multi-agent AI operating system** that orchestrates specialized AI agents — coder, researcher, planner, QA, security, and more — using **local models** by default (Ollama) with optional cloud fallback.

Think of it as a **self-hosted AI team** that runs on your own hardware:

| Capability | What it does |
|------------|--------------|
| **Agent Mesh** | 10+ specialized agents collaborate on complex tasks |
| **Local-First** | Defaults to Ollama (llama3.1, phi3, mistral, qwen2, gemma2) |
| **Model Router** | Picks local vs cloud based on task size/cost/privacy |
| **MCP Protocol** | Connects to filesystem, browser, GitHub, databases |
| **Memory Tiers** | Working, episodic, semantic, procedural — SQLite + ChromaDB |
| **Web Dashboard** | Real-time agent monitoring, chat, workflow visualizer |
| **Autonomous Workflows** | Declarative multi-step execution with recovery |
| **CLI Native** | Beautiful terminal experience — `chakravyuh chat`, `chakravyuh status` |

---

## 🎯 Vision

> **"Many models. One intelligence. Your hardware."**

Chakravyuh is designed to be a **true open-source alternative** to proprietary AI agent platforms. It prioritizes:

- **🥇 Ollama as a first-class citizen** — auto-detect, auto-pull models, no API keys required
- **🔒 Privacy by default** — everything runs locally, no data leaves your machine
- **🎛️ Flexible provider switching** — use Ollama for daily tasks, cloud APIs for heavy lifting
- **🛠️ Developer-friendly** — Python CLI, TypeScript engine, one-command setup

---

## 🧠 Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     CLI / Dashboard                      │
├─────────────────────────────────────────────────────────┤
│                    Chakravyuh CLI                        │
│              (chakravyuh run | chat | models)            │
├─────────────────────────────────────────────────────────┤
│                    Core Orchestrator                     │
│  Router → Agent Registry → Workflow Engine → Dispatcher │
├──────────────────────┬──────────────────────────────────┤
│    Python Backend    │     TypeScript Engine             │
│  (FastAPI + CLI)     │  (TS agents + providers)         │
├──────────────────────┴──────────────────────────────────┤
│                   Provider Layer                         │
│  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────┐   │
│  │ Ollama  │ │  OpenAI  │ │ Anthropic│ │  Others   │   │
│  │ (local) │ │  (cloud) │ │ (cloud)  │ │(DeepSeek, │   │
│  │ 🥇      │ │          │ │          │ │ Google..) │   │
│  └─────────┘ └──────────┘ └──────────┘ └───────────┘   │
├─────────────────────────────────────────────────────────┤
│                   MCP Server Layer                       │
│  Filesystem · Browser · GitHub · Database · Web · Email │
├─────────────────────────────────────────────────────────┤
│                   Memory Layer                           │
│  SQLite (working) · ChromaDB (vector) · FS (procedural) │
└─────────────────────────────────────────────────────────┘
```

---

## 🖥️ CLI Commands

| Command | Description |
|---------|-------------|
| `chakravyuh setup` | One-command setup: install deps, pull models, create .env |
| `chakravyuh run` | Start full system: Ollama + API + dashboard |
| `chakravyuh status` | Show system status: Ollama, models, backend |
| `chakravyuh models` | List, pull, and manage Ollama models |
| `chakravyuh chat` | Interactive chat with any Ollama model |
| `chakravyuh dashboard` | Open web dashboard in browser |
| `chakravyuh version` | Show version info |

---

## 🐳 Docker Compose

```bash
# Default (CPU only)
docker compose up -d

# NVIDIA GPU
COMPOSE_FILE=docker-compose.yml:docker/gpu.nvidia.yml docker compose up -d

# AMD ROCm GPU
COMPOSE_FILE=docker-compose.yml:docker/gpu.amd.yml docker compose up -d
```

The stack includes:
- **Chakravyuh AI** — Python backend on port 3001
- **Ollama** — Local LLM inference on port 11434
- **ChromaDB** — Vector store on port 8100

---

## 🦙 Ollama Integration

Chakravyuh treats Ollama as a **first-class citizen**:

- **Auto-detection** — checks if Ollama is installed and running
- **Auto-pull** — downloads recommended models on `setup` if missing
- **Model management** — `chakravyuh models --list`, `--pull`, `--recommended`
- **Recommended models** (auto-pulled during setup):

| Model | Size | RAM | Best For |
|-------|------|-----|----------|
| `llama3.1:8b` | 4.9GB | 8GB | General-purpose (default) |
| `phi3:14b` | 7.5GB | 12GB | Reasoning, math |
| `mistral:7b` | 4.1GB | 6GB | Fast, efficient |
| `qwen2.5:7b` | 4.2GB | 8GB | Coding, multilingual |
| `gemma2:9b` | 5.3GB | 8GB | Instruction following |
| `nomic-embed-text:v1.5` | 0.2GB | 2GB | Embeddings for memory/RAG |

---

## 📁 Repository Structure

```
chakravyuh-ai/
├── cli/                  # Python CLI (Typer + Rich)
│   ├── main.py           #   Entrypoint: chakravyuh commands
│   └── ollama.py         #   Ollama manager (detect, pull, chat)
├── backend/
│   ├── python/           # Python backend (FastAPI)
│   │   └── api.py        #   REST API + SSE streaming
│   └── src/              # TypeScript engine (orchestrator, agents)
├── agents/               # TS agent implementations
├── mcp/                  # MCP client + servers
├── config/               # YAML runtime configs
├── docker/               # Docker support files
│   ├── entrypoint.sh     #   PUID/PGID privilege drop
│   ├── gpu.nvidia.yml    #   NVIDIA GPU overlay
│   └── gpu.amd.yml       #   AMD ROCm overlay
├── scripts/              # Setup scripts
│   ├── setup.sh          #   Unix one-click setup
│   └── setup.ps1         #   Windows one-click setup
├── tests/                # Test suites
├── docs/                 # Documentation
├── examples/             # Usage examples
├── index.html            # Web dashboard
├── docker-compose.yml    # Full stack deployment
├── Dockerfile            # Multi-stage build
├── pyproject.toml        # Python project config
└── requirements.txt      # Python dependencies
```

---

## 📚 Documentation

| Document | Contents |
|----------|----------|
| [Setup Guide](docs/SETUP.md) | Full native + Docker setup |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow |
| [Agents](docs/AGENTS.md) | Agent types and protocols |
| [Models & Providers](docs/MODELS.md) | Provider config, routing |
| [MCP Servers](docs/MCP_SERVERS.md) | MCP integration catalog |
| [Contributing](CONTRIBUTING.md) | Development workflow |
| [Security](SECURITY.md) | Security policies |
| [Roadmap](ROADMAP.md) | Version milestones |
| [Changelog](docs/CHANGELOG.md) | Release history |

---

## 🤝 Contributing

We welcome contributors from all backgrounds! See [CONTRIBUTING.md](CONTRIBUTING.md).

- **Branch strategy**: `feature/*` → `dev` → `main`
- **Stack**: Python (CLI/API) + TypeScript (engine) + Vanilla JS (frontend)
- **Code style**: Prettier + Ruff (Python)

---

## 💬 Community

- **Discord**: [Join the community](https://discord.gg/xGeeBAWDq)
- **GitHub Discussions**: [Ask questions, share ideas](https://github.com/krushna081/chakravyuh-ai/discussions)
- **Issues**: [Report bugs, request features](https://github.com/krushna081/chakravyuh-ai/issues)

---

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE).

---

<p align="center">
  <sub>Built with ❤️ by <a href="http://krushna081.online/">krushna081</a> and contributors.</sub>
</p>
