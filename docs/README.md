# Documentation

> **⚠ These docs are being updated for v0.2 (Python-native).**  
> Some content below reflects the old TypeScript engine. See the main [README.md](../README.md) for current information.

---

## Core Documentation

| Document | Description | Status |
|----------|-------------|--------|
| [Architecture](ARCHITECTURE.md) | System design and data flow | ⚠ Legacy |
| [Agents](AGENTS.md) | Agent types and protocols | ⚠ Legacy |
| [Models & Providers](MODELS.md) | Provider config and routing | ⚠ Legacy |
| [MCP Servers](MCP_SERVERS.md) | MCP integration catalog | ⚠ Legacy |
| [Setup Guide](SETUP.md) | Native + Docker setup | ✅ Updated |
| [FAQ](FAQ.md) | Frequently asked questions | ✅ Updated |
| [Changelog](CHANGELOG.md) | Release history | ✅ Updated |

---

## Quick Reference

```bash
# Ollama Cloud (no GPU needed)
cp .env.example .env
# Set OLLAMA_HOST=https://ollama.com and OLLAMA_API_KEY
pip install -r requirements.txt
pip install -e .
cv setup --no-pull
cv run

# Local Ollama (requires GPU)
pip install -r requirements.txt
pip install -e .
cv setup
cv run

# TUI (no browser)
cv tui
```
