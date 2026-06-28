from abc import ABC, abstractmethod
from typing import Optional

from core.types import MemoryEntry, MemoryQuery, MemoryType


class MemoryBackend(ABC):
    @abstractmethod
    async def store(self, entry: MemoryEntry) -> str:
        ...

    @abstractmethod
    async def retrieve(self, query: MemoryQuery) -> list[MemoryEntry]:
        ...

    @abstractmethod
    async def delete(self, entry_id: str) -> bool:
        ...

    @abstractmethod
    async def delete_by_agent(self, agent_id: str) -> int:
        ...

    @abstractmethod
    async def count(self, memory_type: Optional[MemoryType] = None) -> int:
        ...

    @abstractmethod
    async def clear(self) -> None:
        ...

    @abstractmethod
    async def close(self) -> None:
        ...
