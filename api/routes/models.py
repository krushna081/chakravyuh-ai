import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from cli.ollama import OllamaManager, RECOMMENDED_MODELS

logger = logging.getLogger("chakravyuh.api.models")
router = APIRouter()

ollama = OllamaManager()


class PullRequest(BaseModel):
    name: str


@router.get("/models")
async def list_models():
    if not ollama.detect() or not ollama.is_running():
        raise HTTPException(status_code=503, detail="Ollama not available")
    models = ollama.list_models()
    return {"models": models, "total": len(models), "recommended": list(RECOMMENDED_MODELS.keys())}


@router.post("/models/pull")
async def pull_model(request: PullRequest):
    if not ollama.detect():
        raise HTTPException(status_code=503, detail="Ollama not installed")
    if not ollama.is_running():
        if not ollama.start():
            raise HTTPException(status_code=503, detail="Could not start Ollama")

    if ollama.has_model(request.name):
        return {"status": "already_installed", "model": request.name}

    import threading
    def do_pull():
        ollama.pull(request.name)

    thread = threading.Thread(target=do_pull, daemon=True)
    thread.start()
    return {"status": "pulling", "model": request.name, "message": f"Pulling {request.name} in background"}


@router.delete("/models/{model_name}")
async def delete_model(model_name: str):
    if not ollama.detect():
        raise HTTPException(status_code=503, detail="Ollama not installed")
    if not ollama.has_model(model_name):
        raise HTTPException(status_code=404, detail=f"Model '{model_name}' not found")
    ollama.remove(model_name)
    return {"status": "removed", "model": model_name}
