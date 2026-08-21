import logging

from fastapi import APIRouter, HTTPException

logger = logging.getLogger("chakravyuh.api.integrations")
router = APIRouter()


def _get_orchestrator():
    from api.app import orchestrator
    return orchestrator


@router.get("/integrations")
async def get_integrations():
    orch = _get_orchestrator()
    if not orch:
        raise HTTPException(status_code=503, detail="Orchestrator not ready")
    return orch.get_integrations()