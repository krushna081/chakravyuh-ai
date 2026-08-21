import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.task_store import get_task_store

logger = logging.getLogger("chakravyuh.api.tasks")
router = APIRouter()


class TaskCreate(BaseModel):
    description: str
    priority: str = "medium"


def _get_control():
    from api.app import orchestrator
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not ready")
    control = orchestrator.get_control_agent()
    if not control:
        raise HTTPException(status_code=503, detail="Control agent not started")
    return control


@router.get("/tasks")
async def list_tasks():
    return {"tasks": get_task_store().list(limit=100)}


@router.get("/tasks/{task_id}")
async def get_task(task_id: str):
    task = get_task_store().get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task '{task_id}' not found")
    return task


@router.post("/tasks")
async def create_task(request: TaskCreate):
    """Queue a task; it runs in the background through the real pipeline."""
    if not request.description.strip():
        raise HTTPException(status_code=400, detail="description is required")
    return await _get_control().submit_async(request.description.strip(), request.priority)