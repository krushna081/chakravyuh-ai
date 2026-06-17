<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://img.shields.io/badge/Chakravyuh_AI-v0.1.0--alpha-8B5CF6?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIyMCIgY3k9IjIwIiByPSIxOCIgc3Ryb2tlPSIjOEI1Q0Y2IiBzdHJva2Utd2lkdGg9IjQiLz48cGF0aCBkPSJNMjAgMnYzNm0tMTQtMTRoMjgiIHN0cm9rZT0iIzhCNUNGNiIgc3Ryb2tlLXdpZHRoPSIzIi8+PC9zdmc+" />
    <img src="https://img.shields.io/badge/Chakravyuh_AI-v0.1.0--alpha-8B5CF6?style=for-the-badge" alt="Chakravyuh AI" />
  </picture>
</p>

<p align="center">
  <strong>Multi-Agent AI Operating System</strong><br>
  <em>Unify. Orchestrate. Autonomous.</em>
</p>

<p align="center">
  <a href="https://github.com/krushna081/chakravyuh-ai/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-blue?style=flat-square" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/version-0.1.0--alpha-orange?style=flat-square" alt="Version"></a>
  <a href="#"><img src="https://img.shields.io/badge/node-%3E%3D18.x-green?style=flat-square" alt="Node"></a>
  <a href="#"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square" alt="PRs Welcome"></a>
  <a href="#"><img src="https://img.shields.io/badge/TypeScript-strict-3178C6?style=flat-square" alt="TypeScript"></a>
  <a href="https://discord.gg/chakravyuh"><img src="https://img.shields.io/badge/discord-join-5865F2?style=flat-square" alt="Discord"></a>
</p>

<p align="center">
  <a href="#overview">Overview</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#contributing">Contributing</a> •
  <a href="#license">License</a>
</p>

---

## Overview

Chakravyuh AI is an **AI Operating System** that connects multiple AI models, agents, MCP servers, tools, and memory systems under a central orchestrator. It provides a unified runtime for building autonomous multi-agent systems — switching between providers, delegating tasks across specialized agents, and persisting context across sessions.

**Key capabilities:**
- **Multi-Provider**: OpenAI, Anthropic, Google, DeepSeek, Grok, OpenRouter, Ollama, and local models
- **Agent Mesh**: Specialized agents with structured peer-to-peer communication
- **MCP Native**: First-class Model Context Protocol support for tools and data sources
- **Memory Systems**: Working, episodic, semantic, and procedural memory tiers
- **Autonomous Workflows**: Declarative multi-step execution with planning and recovery
- **BYO Keys**: Connect your own API keys — no vendor lock-in
- **Local First**: Full offline capability through Ollama and local models

## Quick Start

```bash
git clone https://github.com/krushna081/chakravyuh-ai.git
cd chakravyuh-ai
cp .env.example .env   # add your API keys
npm install
npm run dev
```

> **Prerequisites**: Node.js 18.x+, npm 9.x+, Git 2.x+. See [SETUP.md](docs/SETUP.md) for details.

## Architecture

Chakravyuh AI uses a layered microkernel architecture:

```
┌──────────────────────────────────────────────────────┐
│                    User / API                        │
├──────────────────────────────────────────────────────┤
│               Chakravyuh Orchestrator                 │
│  ┌──────────┐  ┌──────────┐  ┌────────────────────┐  │
│  │  Router   │  │Scheduler │  │   Agent Registry   │  │
│  └────┬─────┘  └────┬─────┘  └─────────┬──────────┘  │
│       │              │                  │              │
│  ┌────▼──────────────▼──────────────────▼──────────┐  │
│  │              Task Analyzer                       │  │
│  └─────────────────────┬──────────────────────────┘  │
│                        │                              │
│  ┌─────────────────────▼──────────────────────────┐  │
│  │            Capability Router                    │  │
│  └─────────────────────┬──────────────────────────┘  │
│                        │                              │
│  ┌─────────────────────▼──────────────────────────┐  │
│  │              Agent Mesh Network                  │  │
│  │  Coder · Browser · Researcher · Planner · QA    │  │
│  │  Memory · Security · GitHub · Deployment        │  │
│  └─────────────────────┬──────────────────────────┘  │
│                        │                              │
│  ┌─────────────────────▼──────────────────────────┐  │
│  │              Provider Layer                      │  │
│  │  OpenAI · Anthropic · Google · DeepSeek · Grok  │  │
│  │  OpenRouter · Ollama · Open-Source              │  │
│  └─────────────────────┬──────────────────────────┘  │
│                        │                              │
│  ┌─────────────────────▼──────────────────────────┐  │
│  │              MCP Server Layer                    │  │
│  │  FileSystem · GitHub · Browser · Database · Web │  │
│  │  Gmail · Drive · Calendar · Terminal · Custom   │  │
│  └─────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

## Features

| Feature | Description |
|---------|-------------|
| **Multi-Provider** | Unified interface over 8+ AI providers — swap models freely |
| **MCP Protocol** | Native Model Context Protocol for tools, resources, and prompts |
| **Agent Mesh** | Specialized agents with structured peer-to-peer messaging |
| **Memory Systems** | 4-tier memory: working (Redis), episodic (SQLite), semantic (Vector DB), procedural (FS) |
| **Autonomous Workflows** | Declarative YAML workflows with planning, branching, and recovery |
| **Capability Routing** | Automatic model selection based on task, cost, speed, and quality |
| **Rate Limiting** | Per-provider, per-agent token and request budgets |
| **BYO API Keys** | Users connect their own keys — no platform lock-in |
| **Local Models** | Full Ollama integration for offline, private inference |
| **Browser Automation** | Headless web interaction via MCP browser server |
| **GitHub Integration** | Code review, PRs, issue management via MCP |
| **Security** | Prompt injection detection, audit logging, approval gates, sandboxing |

## Documentation

| Document | Contents |
|----------|----------|
| [Getting Started](docs/SETUP.md) | Installation, configuration, and first run |
| [Architecture](docs/ARCHITECTURE.md) | System design, data flow, and component details |
| [Agents](docs/AGENTS.md) | Agent types, protocols, and custom agent development |
| [Models & Providers](docs/MODELS.md) | Provider config, model tables, and routing strategies |
| [MCP Servers](docs/MCP_SERVERS.md) | MCP integration, server catalog, and custom servers |
| [Roadmap](ROADMAP.md) | Version milestones, priorities, and timeline |
| [Vision](docs/VISION.md) | Project philosophy and north star |
| [Contributing](CONTRIBUTING.md) | Development workflow, conventions, and standards |
| [Security](SECURITY.md) | Security policies and vulnerability reporting |
| [Governance](docs/GOVERNANCE.md) | Project governance and community roles |
| [FAQ](docs/FAQ.md) | Frequently asked questions |
| [Changelog](docs/CHANGELOG.md) | Release history and change tracking |

## Repository Structure

```
chakravyuh-ai/
├── backend/             # Core orchestrator, API, providers, memory
│   └── src/
│       ├── orchestrator/    # Engine, scheduler, event bus
│       ├── router/          # Message routing and dispatch
│       ├── registry/        # Agent and service registry
│       ├── providers/       # Provider implementations
│       ├── memory/          # Memory backend interfaces
│       ├── mcp/             # MCP client and connection manager
│       ├── api/             # HTTP/WebSocket API
│       └── events/          # Event bus implementation
├── agents/              # Agent definitions, prompts, and tools
├── mcp/                 # MCP server implementations and configs
├── memory/              # Storage drivers and migrations
├── config/              # Runtime configuration files
├── docs/                # Documentation
├── tests/               # Test suites
├── examples/            # Usage examples and tutorials
├── scripts/             # Build, deploy, and utility scripts
└── frontend/            # Web UI (reserved for future)
```

## Contributing

We welcome contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for:

- Branch strategy: `feature/*` → `test` → `dev` → `main`
- Commit conventions: Conventional Commits
- Coding standards: TypeScript strict, Prettier, ESLint
- PR review process and expectations

## Community

- **Discord**: [Join the community](https://discord.gg/chakravyuh)
- **GitHub Discussions**: [Ask questions, share ideas](https://github.com/krushna081/chakravyuh-ai/discussions)
- **Issues**: [Report bugs, request features](https://github.com/krushna081/chakravyuh-ai/issues)

## License

Apache 2.0 — see [LICENSE](LICENSE).
