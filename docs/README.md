<p align="center">
  <img src="https://img.shields.io/badge/version-0.1.0--alpha-orange" alt="Version">
  <img src="https://img.shields.io/badge/license-Apache%202.0-blue" alt="License">
  <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome">
  <img src="https://img.shields.io/badge/node-%3E%3D18.x-green" alt="Node">
</p>

# ⚔️ Chakravyuh AI

**Multi-Agent AI Operating System** — Connect AI models, agents, MCP servers, and memory into autonomous workflows.

---

## Overview

Chakravyuh AI orchestrates multiple AI providers (OpenAI, Anthropic, Google, DeepSeek, Ollama), MCP servers, and specialized agents under a central runtime. Agents communicate, share memory, and collaborate autonomously.

## Quick Start

```bash
git clone https://github.com/anomalyco/chakravyuh-ai.git
cd chakravyuh-ai
cp .env.example .env   # add API keys
npm install
npm run dev
```

## Architecture

```
┌─────────────────────────────────────────────┐
│              Orchestrator Engine             │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐ │
│  │  Router   │ │Scheduler │ │Agent Registry│ │
│  └────┬─────┘ └────┬─────┘ └──────┬───────┘ │
│       │            │               │         │
│  ┌────▼────────────▼───────────────▼───────┐ │
│  │           Agent Mesh Network             │ │
│  │  Coder · Browser · Researcher · Planner │ │
│  │  QA · Memory · Coordinator              │ │
│  └────────────────┬────────────────────────┘ │
│                   │                          │
│  ┌────────────────▼────────────────────────┐ │
│  │           Provider Layer                 │ │
│  │  OpenAI · Anthropic · Google · DeepSeek │ │
│  │  Ollama · Open-Source                   │ │
│  └────────────────┬────────────────────────┘ │
│                   │                          │
│  ┌────────────────▼────────────────────────┐ │
│  │           MCP Server Layer               │ │
│  │  FileSystem · GitHub · Browser · Web     │ │
│  │  Database · Custom                       │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

## Features

| Feature | Description |
|---------|-------------|
| Multi-Provider | Use any AI model interchangeably |
| MCP Protocol | Native Model Context Protocol support |
| Agent Mesh | Specialized agents with peer-to-peer comms |
| Memory Systems | Working, episodic, semantic, procedural |
| Autonomous Workflows | Declarative multi-step task execution |
| GitHub Integration | Code review, PRs, repo management |
| Browser Automation | Headless web interaction via MCP |
| Local Models | Full Ollama integration for offline use |

## Project Structure

```
chakravyuh-ai/
├── backend/      # Orchestrator, API, providers, memory
├── agents/       # Agent definitions and tools
├── mcp/          # MCP server implementations
├── memory/       # Storage backends
├── docs/         # Documentation
├── tests/        # Test suites
├── examples/     # Usage examples
└── frontend/     # (reserved)
```

## Documentation

| File | Contents |
|------|----------|
| [SETUP.md](SETUP.md) | Installation and configuration |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design and data flow |
| [AGENTS.md](AGENTS.md) | Agent types and protocols |
| [MODELS.md](MODELS.md) | Provider and model configuration |
| [MCP_SERVERS.md](MCP_SERVERS.md) | MCP integration details |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Development workflow |
| [SECURITY.md](../SECURITY.md) | Security policies |
| [VISION.md](VISION.md) | Project philosophy |
| [ROADMAP.md](../ROADMAP.md) | Milestones and planning |

## License

Apache 2.0 — see [LICENSE](LICENSE).
