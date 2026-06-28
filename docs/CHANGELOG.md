# Changelog

> Format: [Keep a Changelog](https://keepachangelog.com/) · Versioning: [SemVer](https://semver.org/)

---

## [v0.2.0-alpha] — 2026-06-28

### Added
- Python-native rewrite — unified FastAPI backend, CLI, agents, tools, memory
- 10 specialized Python agents (Coordinator, Planner, Coder, Researcher, Browser, QA, Memory, Security, GitHub, Deployment)
- Control Agent with keyword-based task routing and workflow decomposition
- Per-agent PTY terminal manager with sandbox directories
- Prompt Engineer module for task analysis and prompt crafting
- Textual multi-pane TUI with F1-F10 agent focus switching
- Ollama Cloud support (`OLLAMA_HOST=https://ollama.com`) — no GPU or local downloads
- 7 tool implementations (Filesystem, WebFetch, WebSearch, Terminal, GitHub, Docker, MCP)
- 3 memory backends (InMemory, SQLite, ChromaDB)
- FastAPI REST API with 5 route modules
- React + Vite web dashboard
- Docker Compose with CPU, NVIDIA GPU, and AMD GPU support
- Marketing landing page (`index.html`) + agent control center (`dashboard.html`)
- Cloud provider auth headers for Ollama Cloud API

### Changed
- Migrated from TypeScript/Node.js to Python-native architecture
- Unified backend from dual-stack to single FastAPI server
- CLI migrated from npm scripts to Typer commands (`cv`)
- Environment config migrated from YAML to `.env` with pydantic-settings
- All agent configurations migrated from YAML to Python dataclasses

### Removed
- TypeScript engine backend (`backend/src/` — legacy reference only)
- Python backend (`backend/python/` — legacy reference only)
- YAML configuration files (`config/` directory)

## [v0.1.0-alpha] — 2026-06

### Added
- Repository scaffolding and directory structure
- Root `README.md` with project overview, architecture, and quick start
- Root `package.json` with workspace configuration, scripts, and metadata
- Root `tsconfig.json` with strict TypeScript configuration
- `.env.example` with all supported provider configurations
- `.prettierrc` with project-wide formatting rules
- `.markdownlint.json` for documentation linting
- `.npmrc`, `.node-version`, `.nvmrc` for environment consistency
- `config/` directory with `providers.yaml`, `agents.yaml`, `mcp.yaml` configurations
- `SECURITY.md` with vulnerability reporting policy and best practices
- `CONTRIBUTING.md` with branch strategy, commit conventions, and coding standards
- `SUPPORT.md` with community and commercial support information
- `ADOPTERS.md` for community adoption tracking

### Documentation
- Comprehensive architecture specification with Mermaid diagrams
- Agent catalog with lifecycle, protocol, and custom development guide
- Provider catalog with model tables, pricing, and routing strategies
- MCP server catalog with configuration, CLI, and custom server examples
- Detailed roadmap with Gantt chart, milestones, and priority matrix
- Setup guide with multi-platform instructions (dev, Docker, production)
- Governance model with roles, voting, and progression path
- FAQ with 25+ questions covering general, technical, usage, and community topics
- Ideas document with future agent, MCP, and feature proposals
- Vision document with problem statement, principles, and north star
- Documentation index page at `docs/README.md`

### GitHub Integration
- Issue templates: Bug Report, Feature Request, RFC
- Issue config with community contact links
- Pull request template with checklist and validation
- CI workflow: lint, format check, type check, multi-version test, security audit
- `FUNDING.yml` for sponsor platform integration

### Planned
- OpenAI provider implementation
- Anthropic provider implementation
- Google Gemini provider implementation
- DeepSeek provider implementation
- Grok (xAI) provider implementation
- OpenRouter provider implementation
- Ollama provider implementation
- MCP client with connection pooling
- Agent registry and lifecycle management
- Core orchestrator engine
- Message routing and dispatch
- Workflow scheduler
- Event bus implementation
- Memory backends (working, episodic, semantic, procedural)
- CLI tool implementation
- HTTP/WebSocket API server

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 0.1.0-alpha | Q2 2026 | 🔨 Planning & Architecture |
| 0.0.0 | — | Initial commit |
