# Frequently Asked Questions

---

## General

**What is Chakravyuh AI?**
A multi-agent AI operating system that orchestrates 10 specialized agents (coder, researcher, planner, QA, security, etc.) through a Control Agent. Python-native, terminal-first, with optional web dashboard.

**What does "Chakravyuh" mean?**
A Sanskrit word (चक्रव्यूह) meaning a strategic battle formation — representing coordinated multi-agent collaboration, where each agent plays a specialized role within a larger strategy.

**Who is this for?**
- **Developers** building AI-powered applications
- **Organizations** creating internal AI agent workflows
- **Researchers** experimenting with multi-agent systems
- **Anyone** who wants to use AI agents without a powerful GPU

**Is it production-ready?**
Currently in alpha (v0.2). Core features work — CLI, TUI, API, 10 agents, tools, memory. Breaking changes may occur.

**What's the license?**
Apache 2.0 — free to use, modify, and distribute.

---

## Technical

**What language is used?**
**Python** — unified backend (FastAPI + CLI + agents + tools + memory). The old TypeScript engine was replaced in v0.2.

**Can I run it without a GPU?**
**Yes** — use **Ollama Cloud** (`OLLAMA_HOST=https://ollama.com`) with an API key from ollama.com. All models run on Ollama's servers.

**Can I use local models?**
**Yes** — if you have a GPU, run `cv setup` to install local Ollama and pull models.

**Can I use cloud API providers?**
**Yes** — set `CHAKRAVYUH_ROUTER_MODE=cloud` and add keys for OpenAI, Anthropic, DeepSeek, Google, Groq, or OpenRouter.

**Do I need API keys?**
- **Ollama Cloud** — yes, get one at [ollama.com](https://ollama.com)
- **Local Ollama** — no, everything runs locally
- **Cloud providers** — yes, bring your own keys

**Can I run it fully offline?**
Yes — use local Ollama with downloaded models. No internet connection required.

**What databases are supported?**

| Memory Type | Storage Backends |
|-------------|-----------------|
| Working | In-Memory |
| Episodic | SQLite |
| Semantic | ChromaDB (vector) |
| Procedural | File System |

**How is this different from LangChain / CrewAI / AutoGen?**

| Feature | Chakravyuh | LangChain | CrewAI | AutoGen |
|---------|------------|-----------|--------|---------|
| Multi-agent | ✅ Native | ⚠️ Extensions | ✅ | ✅ |
| Python-native | ✅ | ✅ | ✅ | ✅ |
| Terminal-first | ✅ | ❌ | ❌ | ❌ |
| Per-agent terminals | ✅ | ❌ | ❌ | ❌ |
| Ollama Cloud | ✅ | ❌ | ❌ | ❌ |
| 10 specialized agents | ✅ | Custom | Custom | Custom |
| MCP tools | ✅ | ❌ | ❌ | ❌ |
| 4-tier memory | ✅ | ⚠️ Basic | ⚠️ Basic | ⚠️ Basic |
| BYO API keys | ✅ | ✅ | ✅ | ✅ |

---

## Usage

**How do I get started?**

```bash
git clone https://github.com/krushna081/chakravyuh-ai.git
cd chakravyuh-ai

# Option A: Ollama Cloud (no GPU)
cp .env.example .env
# Edit .env: set OLLAMA_HOST=https://ollama.com and OLLAMA_API_KEY
pip install -r requirements.txt
pip install -e .
cv setup --no-pull
cv run

# Option B: Local Ollama (requires GPU)
pip install -r requirements.txt
pip install -e .
cv setup
cv run
```

**How do I create a custom agent?**
Extend `BaseAgent` from `core/base_agent.py` and implement `handle_message()`. Add it to `agents/__init__.py`.

**How do I use the TUI?**
```bash
pip install textual
cv tui
```

**How do I submit a task?**
```bash
cv task "Write a Python script to sort files"
```

**How do I check system status?**
```bash
cv status
```

**How do I stop the API?**
Press `Ctrl+C` in the terminal running `cv run`.
