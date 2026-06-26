"""Chakravyuh AI — FastAPI backend.

Provides:
  - Chat streaming endpoint (SSE) via Ollama
  - Agent orchestration
  - Model management
  - Health / status endpoints
  - Static file serving for the dashboard
"""

import json
import os
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


# ── Lifespan ──────────────────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    from cli.ollama import OllamaManager
    app.state.ollama = OllamaManager()
    yield


app = FastAPI(
    title="Chakravyuh AI",
    version="0.2.0-alpha",
    description="Multi-Agent AI Operating System",
    lifespan=lifespan,
)


# ── Models ────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    model: str = "llama3.1:8b"
    messages: list[dict] = []
    stream: bool = True
    system: str | None = None


class AgentTask(BaseModel):
    agent: str
    task: str
    context: dict = {}


# ── Routes ───────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Health check endpoint."""
    om = app.state.ollama
    status = om.detect()
    models = om.list_models()
    return {
        "status": "ok",
        "ollama": status,
        "models_installed": len(models),
        "version": "0.2.0-alpha",
    }


@app.post("/v1/chat")
async def chat(req: ChatRequest, request: Request):
    """Chat with an Ollama model via SSE streaming."""
    om = app.state.ollama
    messages = req.messages

    if req.system:
        messages = [{"role": "system", "content": req.system}] + messages

    async def event_stream():
        try:
            for chunk in om.chat(req.model, messages, stream=True):
                if await request.is_disconnected():
                    break
                if chunk.get("done"):
                    yield f"data: {json.dumps({'done': True})}\n\n"
                    break
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield f"data: {json.dumps({'content': content})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@app.post("/v1/agents/{agent_id}/task")
async def dispatch_agent(agent_id: str, task: AgentTask):
    """Dispatch a task to a specific agent."""
    om = app.state.ollama
    agent_prompts = {
        "coordinator": "You are a task coordinator. Decompose and delegate.",
        "coder": "You are a coding agent. Write, review, and refactor code.",
        "planner": "You are a planning agent. Break goals into steps.",
        "researcher": "You are a research agent. Find and synthesize info.",
        "qa": "You are a QA agent. Test and validate.",
        "security": "You are a security agent. Audit and protect.",
        "memory": "You are a memory agent. Store and retrieve context.",
    }
    system_prompt = agent_prompts.get(agent_id, "You are a helpful AI agent.")

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Context: {json.dumps(task.context)}\n\nTask: {task.task}"},
    ]

    full_response = ""
    for chunk in om.chat("llama3.1:8b", messages, stream=False):
        content = chunk.get("message", {}).get("content", "")
        full_response += content

    return {
        "agent": agent_id,
        "task": task.task,
        "response": full_response,
    }


@app.get("/v1/models")
async def list_models():
    """List available Ollama models."""
    om = app.state.ollama
    models = om.list_models()
    return {"models": models, "count": len(models)}


@app.post("/v1/models/pull")
async def pull_model(model: str):
    """Pull an Ollama model."""
    om = app.state.ollama
    return {"status": "started", "model": model}


@app.get("/v1/status")
async def system_status():
    """Full system status."""
    om = app.state.ollama
    return {
        "ollama": om.detect(),
        "models": [m["name"] for m in om.list_models()],
        "server": "running",
    }


# ── Static Files (Dashboard) ─────────────────────────────────────────

dashboard_path = REPO_ROOT / "index.html"
if dashboard_path.exists():
    from fastapi.responses import FileResponse

    @app.get("/", response_class=HTMLResponse, include_in_schema=False)
    async def serve_dashboard():
        return HTMLResponse(dashboard_path.read_text(encoding="utf-8"))


# ── Entrypoint ────────────────────────────────────────────────────────
def main():
    import uvicorn
    host = os.getenv("CHAKRAVYUH_HOST", "127.0.0.1")
    port = int(os.getenv("CHAKRAVYUH_PORT", "3001"))
    uvicorn.run("backend.python.api:app", host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
