# FAQ

## General

**What is Chakravyuh AI?**  
A multi-agent AI operating system that connects AI models, MCP servers, tools, memory, and agents under a central orchestrator.

**What does "Chakravyuh" mean?**  
A Sanskrit word for a strategic battle formation — representing coordinated multi-agent collaboration.

**Who is this for?**  
Developers, organizations, researchers, and hobbyists building multi-agent AI systems.

**Is it production-ready?**  
No — currently v0.1-alpha (planning phase).

## Technical

**What language?**  
TypeScript (Node.js) for the core. MCP servers can be Python, Go, Rust, etc.

**Databases?**  
SQLite/PostgreSQL (episodic), Redis (working), Vector DBs (semantic), filesystem (procedural).

**Need API keys?**  
Yes for cloud providers. Ollama runs fully offline.

**How is this different from LangChain / CrewAI?**

| Feature | Chakravyuh | LangChain | CrewAI |
|---------|------------|-----------|--------|
| Multi-agent | ✅ Native | ⚠️ Extensions | ✅ |
| MCP protocol | ✅ First-class | ❌ | ❌ |
| Provider agnostic | ✅ Core | ⚠️ Partial | ⚠️ Partial |
| Memory (4 types) | ✅ | ⚠️ Basic | ⚠️ Basic |
| Agent-to-agent | ✅ Structured | ❌ | ✅ |

## Usage

**How to start?**  
```bash
git clone && npm install && cp .env.example .env && npm run dev
```

**Custom agents?**  
Yes — extend `BaseAgent`.

**Custom MCP servers?**  
Yes — any MCP-compatible server works.

**Cost?**  
Free (Apache 2.0). Pay only for API usage or infrastructure.

## Community

**How to contribute?**  
See [CONTRIBUTING.md](CONTRIBUTING.md).

**Found a bug?**  
Open a [GitHub Issue](https://github.com/anomalyco/chakravyuh-ai/issues).

**Security issue?**  
Email security@chakravyuh.dev — see [SECURITY.md](SECURITY.md).

**License?**  
Apache 2.0.

**Community chat?**  
[Join Discord](https://discord.gg/chakravyuh).
