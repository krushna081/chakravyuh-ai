# Frequently Asked Questions

---

## General

**What is Chakravyuh AI?**
A multi-agent AI operating system that connects AI models, MCP servers, tools, memory, and agents under a central orchestrator. It provides a unified runtime for building autonomous multi-agent systems.

**What does "Chakravyuh" mean?**
A Sanskrit word (चक्रव्यूह) meaning a strategic battle formation — representing coordinated multi-agent collaboration, where each agent plays a specialized role within a larger strategy.

**Who is this for?**
- **Developers** building AI-powered applications
- **Organizations** creating internal AI agent workflows
- **Researchers** experimenting with multi-agent systems
- **Hobbyists** running local models with Ollama

**Is it production-ready?**
No — currently in pre-alpha (v0.1). The architecture is being designed and core components are being built.

**What's the license?**
Apache 2.0 — free to use, modify, and distribute.

---

## Technical

**What language is used?**
TypeScript (Node.js) for the core orchestrator, providers, and API. MCP servers can be implemented in any language (Python, Go, Rust, etc.).

**What databases are supported?**

| Memory Type | Storage Backends |
|-------------|-----------------|
| Working | Redis, In-Memory |
| Episodic | SQLite, PostgreSQL |
| Semantic | pgvector, Qdrant, Pinecone, Chroma |
| Procedural | File System |

**Do I need API keys?**
Yes for cloud providers (OpenAI, Anthropic, Google, DeepSeek, Grok). Ollama runs fully offline with local models.

**Can I use my own API keys?**
Yes — that's a core design principle. You bring your own keys and Chakravyuh handles the rest.

**Can I run it fully offline?**
Yes — configure Ollama with local models and disable cloud providers. No internet connection required.

**How is this different from LangChain / CrewAI / AutoGen?**

| Feature | Chakravyuh | LangChain | CrewAI | AutoGen |
|---------|------------|-----------|--------|---------|
| Multi-agent | ✅ Native | ⚠️ Extensions | ✅ | ✅ |
| MCP protocol | ✅ First-class | ❌ | ❌ | ❌ |
| Provider agnostic | ✅ Core | ⚠️ Partial | ⚠️ Partial | ⚠️ Partial |
| 4-tier memory | ✅ | ⚠️ Basic | ⚠️ Basic | ⚠️ Basic |
| Structured agent comms | ✅ | ❌ | ✅ | ✅ |
| Capability routing | ✅ | ❌ | ❌ | ❌ |
| BYO API keys | ✅ | ✅ | ✅ | ✅ |

---

## Usage

**How do I get started?**

```bash
git clone https://github.com/krushna081/chakravyuh-ai.git
cd chakravyuh-ai
cp .env.example .env   # add your API keys
npm install
npm run dev
```

See the [Setup Guide](SETUP.md) for detailed instructions.

**How do I create a custom agent?**
Extend `BaseAgent` and implement the `onMessage` method. See [Custom Agent Development](AGENTS.md#custom-agent-development).

**How do I connect a custom MCP server?**
Any MCP-compatible server works. Configure it in `config/mcp.yaml`. See [MCP Servers](MCP_SERVERS.md#custom-mcp-server).

**Can I use Chakravyuh with OpenRouter?**
Yes — OpenRouter is supported as a provider, giving access to 200+ models through a single API.

**How does model selection work?**
The capability router automatically selects the best model based on task requirements, cost, speed, and availability. You can also configure static assignments or fallback chains.

**What is the cost?**
Chakravyuh itself is free (Apache 2.0). You pay only for the API usage of the models you use (if using cloud providers). Local models through Ollama are free.

---

## Community

**How can I contribute?**
See [CONTRIBUTING.md](../CONTRIBUTING.md) for development workflow, coding standards, and contribution guidelines.

**How do I report a bug?**
Open a [Bug Report](https://github.com/krushna081/chakravyuh-ai/issues/new?template=01_bug_report.yml).

**How do I report a security issue?**
Email **security@chakravyuh.dev** — see [SECURITY.md](../SECURITY.md).

**How do I suggest a feature?**
Open a [Feature Request](https://github.com/krushna081/chakravyuh-ai/issues/new?template=02_feature_request.yml).

**Where can I ask questions?**
- [GitHub Discussions](https://github.com/krushna081/chakravyuh-ai/discussions)
- [Discord Community](https://discord.gg/chakravyuh)

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Build fails | `npm run clean && npm install && npm run build` |
| Provider not configured | Set the required API key in `.env` |
| Ollama connection refused | Run `ollama serve` |
| MCP server not found | Install the required package |
| Agent timeout | Increase `limits.timeout` in agent config |
| Rate limited | Wait or increase rate limit config |
| Memory backend error | Check Redis/PostgreSQL is running |
