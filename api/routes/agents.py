import logging

from fastapi import APIRouter, HTTPException

logger = logging.getLogger("chakravyuh.api.agents")
router = APIRouter()


def _get_orchestrator():
    from api.app import orchestrator
    return orchestrator


@router.get("/agents")
async def list_agents():
    orch = _get_orchestrator()
    if not orch:
        raise HTTPException(status_code=503, detail="Orchestrator not ready")

    agents_list = [
        {
            "id": agent.id,
            "name": agent.name,
            "role": agent.role,
            "status": agent.status.value,
            "capabilities": [c.value for c in agent.capabilities],
            "model": agent.config.model,
            "provider": agent.config.provider.value if hasattr(agent.config.provider, "value") else str(agent.config.provider),
            "uptime": agent.get_uptime(),
        }
        for agent in orch.agents.values()
    ]
    return {"agents": agents_list, "total": len(agents_list)}


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str):
    orch = _get_orchestrator()
    if not orch:
        raise HTTPException(status_code=503, detail="Orchestrator not ready")
    agent = orch.get_agent(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{agent_id}' not found")
    return {
        "id": agent.id,
        "name": agent.name,
        "role": agent.role,
        "status": agent.status.value,
        "capabilities": [c.value for c in agent.capabilities],
        "model": agent.config.model,
        "provider": agent.config.provider.value if hasattr(agent.config.provider, "value") else str(agent.config.provider),
        "uptime": agent.get_uptime(),
        "tools": agent.config.tools,
        "memory_scope": [m.value for m in agent.config.memory_scope],
        "allowed_peers": agent.config.allowed_peers,
    }
