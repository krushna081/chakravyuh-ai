import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api.routes.chat import router as chat_router
from api.routes.agents import router as agents_router
from api.routes.models import router as models_router
from api.routes.memory import router as memory_router
from api.routes.system import router as system_router
from core.orchestrator import Orchestrator
from core.types import RouterMode

logger = logging.getLogger("chakravyuh.api")

orchestrator: Optional[Orchestrator] = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global orchestrator
    logger.info("Starting Chakravyuh API server...")

    mode_name = os.getenv("CHAKRAVYUH_ROUTER_MODE", "local")
    router_mode = RouterMode(mode_name) if mode_name in ("local", "hybrid", "cloud") else RouterMode.LOCAL

    orchestrator = Orchestrator(router_mode=router_mode)

    from cli.ollama import OllamaManager
    ollama = OllamaManager()
    if ollama.detect() and ollama.is_running():
        models = [m["name"] for m in ollama.list_models()]
        orchestrator.set_ollama_status(True, models)
        logger.info(f"Ollama connected with {len(models)} models")

    from agents import create_all_agents
    agents = create_all_agents()
    for agent_id, agent in agents.items():
        orchestrator.register_agent(agent)

    await orchestrator.start()
    logger.info("Chakravyuh API ready")

    yield

    if orchestrator:
        await orchestrator.stop()
    logger.info("Chakravyuh API stopped")


app = FastAPI(
    title="Chakravyuh AI API",
    version="0.2.0",
    description="Multi-Agent AI Operating System — API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(system_router, prefix="/api/v1", tags=["System"])
app.include_router(chat_router, prefix="/api/v1", tags=["Chat"])
app.include_router(agents_router, prefix="/api/v1", tags=["Agents"])
app.include_router(models_router, prefix="/api/v1", tags=["Models"])
app.include_router(memory_router, prefix="/api/v1", tags=["Memory"])


@app.get("/health")
async def health():
    from cli.ollama import OllamaManager
    ollama = OllamaManager()
    models = ollama.list_models() if ollama.detect() and ollama.is_running() else []
    orch = globals().get("orchestrator")
    return {
        "status": "ok",
        "version": "0.2.0",
        "ollama_connected": ollama.detect() == "running",
        "models_installed": len(models),
        "agents_registered": len(orch.agents) if orch else 0,
        "router_mode": orch.router_mode.value if orch else "unknown",
    }


# Serve static files
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "web", "dist")
if os.path.exists(static_dir):
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")
else:
    @app.get("/")
    async def root():
        return {"message": "Chakravyuh AI API — Web UI not built. Run `cd web && npm run build`"}
