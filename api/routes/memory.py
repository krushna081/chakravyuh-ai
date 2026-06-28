import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from core.types import MemoryType, MemoryEntry, MemoryQuery
from memory import create_memory_backend

logger = logging.getLogger("chakravyuh.api.memory")
router = APIRouter()

memory = create_memory_backend("sqlite")


class StoreRequest(BaseModel):
    agent_id: str
    type: str = "episodic"
    content: str
    metadata: dict | None = None


class QueryRequest(BaseModel):
    query: str
    type: str | None = None
    agent_id: str | None = None
    limit: int = 10


@router.post("/memory/store")
async def store_memory(request: StoreRequest):
    import uuid
    from datetime import datetime
    entry = MemoryEntry(
        id=uuid.uuid4().hex[:12],
        agent_id=request.agent_id,
        type=MemoryType(request.type) if request.type in ("working", "episodic", "semantic", "procedural") else MemoryType.EPISODIC,
        content=request.content,
        metadata=request.metadata or {},
        timestamp=datetime.now().isoformat(),
    )
    entry_id = await memory.store(entry)
    return {"status": "stored", "id": entry_id}


@router.post("/memory/query")
async def query_memory(request: QueryRequest):
    query = MemoryQuery(
        query=request.query,
        type=MemoryType(request.type) if request.type else None,
        agent_id=request.agent_id,
        limit=request.limit,
    )
    results = await memory.retrieve(query)
    return {
        "results": [
            {
                "id": r.id,
                "agent_id": r.agent_id,
                "type": r.type.value,
                "content": r.content[:500],
                "timestamp": r.timestamp,
            }
            for r in results
        ],
        "total": len(results),
    }


@router.get("/memory/stats")
async def memory_stats():
    counts = {}
    for mt in MemoryType:
        counts[mt.value] = await memory.count(mt)
    total = await memory.count()
    return {"counts": counts, "total": total}


@router.delete("/memory/{entry_id}")
async def delete_memory(entry_id: str):
    deleted = await memory.delete(entry_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Memory entry not found")
    return {"status": "deleted", "id": entry_id}


@router.delete("/memory/agent/{agent_id}")
async def clear_agent_memory(agent_id: str):
    count = await memory.delete_by_agent(agent_id)
    return {"status": "cleared", "agent_id": agent_id, "entries_removed": count}
