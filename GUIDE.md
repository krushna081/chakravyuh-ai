# Chakravyuh AI — Step-by-Step Guide

The multi-agent command center: 10 real agents (Planner, Coder, Researcher,
QA, Security, GitHub, Deployment, …) run real turns through Ollama with
sandboxed tools, a control agent routes tasks with a real SQLite ledger,
and the web UI shows only real state — no simulated activity.

---

## 1. Prerequisites

| Component | Required | Notes |
|---|---|---|
| Python | 3.11+ | `python3 --version` |
| Node.js | 18+ | `node --version` (on this machine: `/home/karma081/.nvm/versions/node/v24.19.0/bin`) |
| Ollama | optional but recommended | The agent brain. Without it agents report "LLM unavailable" honestly |

> If Node isn't on your PATH: `export PATH=/home/karma081/.nvm/versions/node/v24.19.0/bin:$PATH`

---

## 2. Install the backend

```bash
cd /home/karma081/chakravyuh-ai

# Create the virtual environment (first time only)
python3 -m venv venv
# If venv creation fails with "ensurepip is not available":
#   curl -sS https://bootstrap.pypa.io/get-pip.py -o /tmp/get-pip.py
#   ./venv/bin/python /tmp/get-pip.py -q

# Install dependencies
./venv/bin/pip install -r requirements.txt

# Optional config (names only — never commit real keys)
cp .env.example .env
```

---

## 3. Start the backend (FastAPI :3001)

```bash
./venv/bin/python -m uvicorn api.app:app --host 127.0.0.1 --port 3001
```

Verify:

```bash
curl http://127.0.0.1:3001/health
# {"status":"ok","version":"0.2.0","ollama_connected":false,"models_installed":0,"agents_registered":10,...}
```

- `agents_registered: 10` → the formation is up.
- `ollama_connected: false` → agents will work, but turns will fail with an
  honest "LLM unavailable" error until step 6.

---

## 4. Install and run the web app

```bash
cd /home/karma081/chakravyuh-ai/web
npm install

# Dev server (proxies /api and /health to :3001)
npm run dev -- --port 5174 --strictPort
```

Open **http://localhost:5174/**

Production build (served by FastAPI itself):

```bash
npm run build          # → web/dist
# then visit http://127.0.0.1:3001/ (FastAPI serves the dist folder)
```

---

## 5. First run — readiness + onboarding

1. A **Readiness Screen** probes everything: orchestrator, 10 agents, tools
   (DuckDuckGo search, web fetch, sandboxed filesystem, GitHub, Docker),
   and Ollama. Each integration shows status + reason + fix.
2. The **onboarding wizard** asks you to enlist a **Commander** (the
   orchestrator agent) — give it a name and insignia.
3. You land in the command center: formation floor (left), agent panel
   (right), roster dock (bottom).

---

## 6. Connect Ollama (the brain) — recommended

```bash
# Install: https://ollama.com/download
ollama serve                          # start the server
ollama pull llama3.1:8b               # the default model
```

Backend picks it up automatically (health now reports
`ollama_connected: true`). The header pill changes from
`engine degraded (ollama offline)` to `engine ready`.

Per-agent models: planner/coordinator/researcher/security/memory use
`llama3.1:8b`; coder/github use `qwen2.5:7b`; browser `mistral:7b`;
qa `gemma2:9b`; deployment `phi3:14b`. Pull any you want to use, or change
the model in `agents/__init__.py`.

---

## 7. Use it

### Prompt an agent (real turn)
1. Click an agent card on the floor / roster dock.
2. Type in the **composer** (session tab) → Enter. It queues, then the turn
   runs on the backend: system prompt → LLM → optional `TOOL_CALL:` → tool
   execution → final answer.
3. Watch the **session stream** (polled from `/api/v1/agents/{id}/session`)
   and the **activity** tab for the real work log.

### Queue a task (real pipeline)
1. Open the Commander panel → **tasks** tab.
2. Type a task (e.g. "research the history of the chakravyuh formation") →
   **queue**.
3. The control agent decomposes it (LLM, falling back to keyword routing),
   runs each step through the assigned agent, and records
   `queued → running → completed | failed` in the SQLite ledger.
4. The kanban is read-only over that ledger — click a card to inspect real
   per-step results and errors.

### Check engine state
- Header pills: engine status, router mode, models, memory entries.
- Settings → **integrations**: live status of every integration with its
  env var name and fix.
- Settings → **memory**: real entry counts (SQLite).

---

## 8. Troubleshooting

| Symptom | Fix |
|---|---|
| Readiness screen "Connection failed" | Backend not running — start it (step 3), then **retry connection** |
| "LLM unavailable: Ollama is not_installed / stopped" | Install Ollama, `ollama serve`, pull the model (step 6) |
| "Model 'x' is not installed" | `ollama pull <model>` — listed in the error message |
| GitHub agent errors | Set `GITHUB_TOKEN` in the backend environment (name only — never commit the value) |
| Port 5174/3001 busy | `fuser -k 5174/tcp` / `fuser -k 3001/tcp`, restart |
| Agents blocked after backend restart | Re-open the page — the UI re-syncs automatically; pending prompts drain again |

---

## 9. What is deliberately NOT simulated

- No fake scan results, progress bars, statistics, or "completed" states.
- No canned agent replies: without Ollama every turn fails with the real
  reason.
- Integrations show their true state (connected / not_configured /
  disconnected) with the env var name and an alternative.
- The task ledger, memory, and session logs are real SQLite data.