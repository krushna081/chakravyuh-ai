# Setup Guide

> **Note:** Chakravyuh is now **Python-native** (v0.2+). The old TypeScript engine has been replaced.

---

## Prerequisites

| Tool | Required | Notes |
|------|----------|-------|
| Python | 3.11+ | [python.org](https://python.org) |
| Ollama | Optional | Only for local models. Not needed for Ollama Cloud. |
| Git | 2.x | For cloning the repo |

---

## Quick Install (Ollama Cloud — No GPU, No Downloads)

```bash
git clone https://github.com/krushna081/chakravyuh-ai.git
cd chakravyuh-ai

python -m pip install -r requirements.txt
pip install -e .

cp .env.example .env
# Edit .env:
#   Set OLLAMA_HOST=https://ollama.com
#   Set OLLAMA_API_KEY=your_key

cv setup --no-pull
cv run
```

> **Ollama Cloud** lets you run models on Ollama's servers — no GPU or model downloads needed.  
> Get an API key at [ollama.com](https://ollama.com).

---

## Quick Install (Local Ollama)

```bash
git clone https://github.com/krushna081/chakravyuh-ai.git
cd chakravyuh-ai

python -m pip install -r requirements.txt
pip install -e .

cp .env.example .env
# Edit .env if needed (OLLAMA_HOST defaults to http://127.0.0.1:11434)

cv setup     # auto-detect Ollama and pull models
cv run       # start API + dashboard
```

---

## Cloud Providers (Optional)

If you prefer OpenAI, Anthropic, DeepSeek, etc., set `CHAKRAVYUH_ROUTER_MODE=cloud` in `.env` and add your API keys.

---

## Docker Setup

```bash
docker compose -f docker/docker-compose.yml up -d
```

For GPU support, see `docker/docker-compose.gpu-nvidia.yml` or `docker/docker-compose.gpu-amd.yml`.

---

## TUI (No Browser Needed)

```bash
pip install textual
cv tui
```

Launches a multi-pane Textual dashboard with Prompt Engineer input + 10 agent terminal panels.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `cv` command not found | Run `pip install -e .` to register the CLI |
| Ollama Cloud unreachable | Check `OLLAMA_API_KEY` in `.env` is correct |
| `python` not found | Install Python 3.11+ from python.org |
| Port 3001 in use | Change `CHAKRAVYUH_API_PORT` in `.env` |
