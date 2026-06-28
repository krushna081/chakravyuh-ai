from typing import Optional
from datetime import datetime

from memory.interface import MemoryBackend
from core.types import MemoryEntry, MemoryQuery, MemoryType


class InMemoryBackend(MemoryBackend):
    def __init__(self):
        self._entries: list[MemoryEntry] = []

    async def store(self, entry: MemoryEntry) -> str:
        self._entries.append(entry)
        return entry.id

    async def retrieve(self, query: MemoryQuery) -> list[MemoryEntry]:
        results = []
        for e in self._entries:
            if query.type and e.type != query.type:
                continue
            if query.agent_id and e.agent_id != query.agent_id:
                continue
            if query.query.lower() in e.content.lower():
                results.append(e)
        return results[-query.limit:] if len(results) > query.limit else results

    async def delete(self, entry_id: str) -> bool:
        for i, e in enumerate(self._entries):
            if e.id == entry_id:
                self._entries.pop(i)
                return True
        return False

    async def delete_by_agent(self, agent_id: str) -> int:
        count = 0
        self._entries = [e for e in self._entries if e.agent_id != agent_id]
        return count

    async def count(self, memory_type: Optional[MemoryType] = None) -> int:
        if memory_type:
            return sum(1 for e in self._entries if e.type == memory_type)
        return len(self._entries)

    async def clear(self) -> None:
        self._entries.clear()

    async def close(self) -> None:
        self._entries.clear()
