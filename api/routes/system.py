import logging

from fastapi import APIRouter, HTTPException

logger = logging.getLogger("chakravyuh.api.system")
router = APIRouter()


def _get_orch():
    from api.app import orchestrator
    return orchestrator


@router.get("/status")
async def get_status():
    orch = _get_orch()
    if not orch:
        return {"status": "error", "message": "Orchestrator not initialized"}
    state = orch.get_state()
    return {
        "status": "ok",
        "engine_state": state.engine_status,
        "active_agents": state.active_agents,
        "total_agents": state.total_agents,
        "active_tasks": state.active_tasks,
        "ollama_connected": state.ollama_connected,
        "ollama_models": state.ollama_models,
        "router_mode": state.router_mode.value,
        "uptime": state.uptime,
        "memory_usage": state.memory_usage,
    }


@router.post("/task")
async def submit_task(description: str, priority: str = "medium"):
    orch = _get_orch()
    if not orch:
        raise HTTPException(status_code=503, detail="Orchestrator not ready")
    result = await orch.submit_task(description, priority)
    return result
