# Setup Guide

Chakravyuh AI is a multi-agent command center. The system runs a **Python FastAPI backend** (`:3001`) with a **React + Vite Command Center** (`:5174`).

---

## Prerequisites

| Tool | Required | Notes |
|------|----------|-------|
| Python | 3.11+ | `python3 --version` |
| Node.js | 18+ | `node --version` (for the Web Command Center) |
| Ollama | Optional | Recommended for local inference (`ollama serve`). Not required for startup. |
| Git | 2.x | For cloning and version control |

---

## 1. Quick Backend Setup

```bash
git clone https://github.com/krushna081/chakravyuh-ai.git
cd chakravyuh-ai

# Create virtual environment and install dependencies
python3 -m venv venv
./venv/bin/pip install -r requirements.txt

# Configure environment (copy template)
cp .env.example .env

# Run FastAPI backend
./venv/bin/python -m uvicorn api.app:app --host 127.0.0.1 --port 3001
```

Verify backend health:
```bash
curl http://127.0.0.1:3001/health
```

---

## 2. Web Command Center Setup

In a new terminal:

```bash
cd chakravyuh-ai/web

# Install dependencies
npm install

# Run dev server
npm run dev -- --port 5174 --strictPort
```

Open `http://localhost:5174` in your browser.

To create a production build served directly by FastAPI:
```bash
npm run build
# The compiled bundle in `web/dist` will be served by FastAPI at http://127.0.0.1:3001/
```

---

## 3. Connecting Ollama (Agent Brain)

```bash
# Start Ollama service
ollama serve

# Pull default model
ollama pull llama3.1:8b
```

Once connected, the engine readiness probe in the command center automatically turns green (`engine ready`).

---

## 4. Docker Setup

```bash
# CPU only
docker compose -f docker/docker-compose.yml up -d

# NVIDIA GPU
docker compose -f docker/docker-compose.yml -f docker/docker-compose.gpu-nvidia.yml up -d
```

---

## 5. Troubleshooting

| Problem | Solution |
|---------|----------|
| `Port 3001 or 5174 in use` | Run `fuser -k 3001/tcp` or `fuser -k 5174/tcp` |
| `LLM unavailable` | Start Ollama with `ollama serve` and pull `llama3.1:8b` |
| `Readiness Screen connection error` | Ensure the backend is running on `127.0.0.1:3001` |
| `ModuleNotFoundError` | Verify running Python with `./venv/bin/python` |
