import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from cli.ollama import OllamaManager

logger = logging.getLogger("chakravyuh.api.chat")
router = APIRouter()

ollama = OllamaManager()


class ChatRequest(BaseModel):
    model: str = "llama3.1:8b"
    messages: list[dict]
    stream: bool = True
    agent_id: str | None = None


class ChatResponse(BaseModel):
    model: str
    message: dict
    done: bool = True


@router.post("/chat")
async def chat_completion(request: ChatRequest):
    if not ollama.detect() or not ollama.is_running():
        raise HTTPException(status_code=503, detail="Ollama not available")

    if not ollama.has_model(request.model):
        raise HTTPException(status_code=400, detail=f"Model {request.model} not found. Pull it first.")

    if request.stream:
        async def stream():
            for chunk in ollama.chat(request.model, request.messages, stream=True):
                yield f"data: {json.dumps(chunk)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(
            stream(),
            media_type="text/event-stream",
            headers={"Cache-Control": "no-cache", "Connection": "keep-alive"},
        )
    else:
        response = None
        for chunk in ollama.chat(request.model, request.messages, stream=False):
            response = chunk
        return ChatResponse(
            model=request.model,
            message=response.get("message", {"role": "assistant", "content": ""}),
        )


@router.post("/chat/agent")
async def agent_chat(request: ChatRequest):
    if not request.agent_id:
        raise HTTPException(status_code=400, detail="agent_id is required")

    from api.app import orchestrator
    if not orchestrator:
        raise HTTPException(status_code=503, detail="Orchestrator not ready")

    agent = orchestrator.get_agent(request.agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail=f"Agent '{request.agent_id}' not found")

    last_msg = request.messages[-1]["content"] if request.messages else ""

    from core.types import AgentMessage, MessagePriority
    from datetime import datetime
    import uuid

    msg = AgentMessage(
        id=uuid.uuid4().hex[:12],
        from_agent="user",
        to_agent=request.agent_id,
        type="request",
        priority=MessagePriority.MEDIUM,
        payload={"task": last_msg, "data": {}},
        metadata={"timestamp": datetime.now().isoformat(), "trace_id": uuid.uuid4().hex[:12]},
    )

    result = await agent.handle_message(msg)
    return {"status": "ok", "agent_id": request.agent_id, "result": result}
