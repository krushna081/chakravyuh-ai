import logging
from typing import Any

from core.base_agent import BaseAgent
from core.types import AgentMessage, MemoryType

logger = logging.getLogger("chakravyuh.agents.memory")


class MemoryAgent(BaseAgent):
    def __init__(self, config):
        super().__init__(config)
        self._memories: dict[str, list[dict]] = {
            "episodic": [], "semantic": [], "procedural": [], "working": []
        }

    async def handle_message(self, message: AgentMessage) -> dict[str, Any]:
        task = message.payload.get("task", "")
        action = message.payload.get("action", "store")
        memory_type = message.payload.get("memory_type", "episodic")
        content = message.payload.get("content", "")

        if action == "store":
            return await self._store(memory_type, content, message)
        elif action == "retrieve":
            return await self._retrieve(memory_type, content, message)
        elif action == "prune":
            return await self._prune(memory_type, message)
        else:
            return self._status()

    async def _store(self, memory_type: str, content: str, message: AgentMessage) -> dict[str, Any]:
        mtype = memory_type if memory_type in self._memories else "episodic"
        entry = {
            "id": f"mem-{len(self._memories[mtype]) + 1}",
            "type": mtype,
            "content": content,
            "source": message.from_agent,
            "timestamp": message.metadata.get("timestamp", ""),
        }
        self._memories[mtype].append(entry)

        await self._event_bus.publish("memory.stored", {
            "type": mtype,
            "agent_id": message.from_agent,
            "content_length": len(content),
        })

        return {
            "status": "stored",
            "memory_type": mtype,
            "memory_id": entry["id"],
            "total_memories": sum(len(v) for v in self._memories.values()),
        }

    async def _retrieve(self, memory_type: str, query: str, message: AgentMessage) -> dict[str, Any]:
        mtype = memory_type if memory_type in self._memories else None
        memories = []
        for t, entries in self._memories.items():
            if mtype and t != mtype:
                continue
            for e in entries:
                if query.lower() in e["content"].lower():
                    memories.append(e)

        return {
            "status": "retrieved",
            "query": query[:100],
            "memory_type": mtype or "all",
            "results": memories[-10:],
            "total_matches": len(memories),
        }

    async def _prune(self, memory_type: str, message: AgentMessage) -> dict[str, Any]:
        mtype = memory_type if memory_type in self._memories else None
        pruned = 0
        for t in (mtype, ) if mtype else self._memories:
            count_before = len(self._memories[t])
            self._memories[t] = self._memories[t][-100:]
            pruned += count_before - len(self._memories[t])

        return {
            "status": "pruned",
            "memory_type": mtype or "all",
            "pruned_entries": pruned,
            "remaining": sum(len(v) for v in self._memories.values()),
        }

    def _status(self) -> dict[str, Any]:
        return {
            "status": "ok",
            "memory_counts": {k: len(v) for k, v in self._memories.items()},
            "total": sum(len(v) for v in self._memories.values()),
        }
