import logging
from typing import Optional

from memory.interface import MemoryBackend
from core.types import MemoryEntry, MemoryQuery, MemoryType

logger = logging.getLogger("chakravyuh.memory.chroma")


class ChromaBackend(MemoryBackend):
    def __init__(self, path: str = "data/chromadb", collection_name: str = "chakravyuh"):
        self._path = path
        self._collection_name = collection_name
        self._client = None
        self._collection = None

    async def _ensure_client(self):
        if self._client is not None:
            return
        try:
            import chromadb
            self._client = chromadb.PersistentClient(path=self._path)
            self._collection = self._client.get_or_create_collection(
                name=self._collection_name,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("ChromaDB client initialized")
        except ImportError:
            logger.warning("chromadb not installed, falling back to keyword-only mode")
            self._client = False

    async def store(self, entry: MemoryEntry) -> str:
        await self._ensure_client()
        if not self._client or not self._collection:
            return entry.id

        self._collection.add(
            ids=[entry.id],
            documents=[entry.content],
            metadatas=[{
                "agent_id": entry.agent_id,
                "type": entry.type.value,
                "timestamp": entry.timestamp,
            }],
        )
        return entry.id

    async def retrieve(self, query: MemoryQuery) -> list[MemoryEntry]:
        await self._ensure_client()
        if not self._client or not self._collection:
            return []

        where_filter = {}
        if query.type:
            where_filter["type"] = query.type.value
        if query.agent_id:
            where_filter["agent_id"] = query.agent_id

        results = self._collection.query(
            query_texts=[query.query],
            n_results=query.limit,
            where=where_filter or None,
        )

        entries = []
        for i, doc in enumerate(results.get("documents", [[]])[0] if results.get("documents") else []):
            meta = results.get("metadatas", [[{}]])[0][i] if results.get("metadatas") else {}
            entry = MemoryEntry(
                id=results["ids"][0][i] if results.get("ids") else f"chroma-{i}",
                agent_id=meta.get("agent_id", ""),
                type=MemoryType(meta.get("type", "episodic")),
                content=doc,
                metadata=meta,
                timestamp=meta.get("timestamp", ""),
            )
            entries.append(entry)
        return entries

    async def delete(self, entry_id: str) -> bool:
        await self._ensure_client()
        if not self._client or not self._collection:
            return False
        self._collection.delete(ids=[entry_id])
        return True

    async def delete_by_agent(self, agent_id: str) -> int:
        await self._ensure_client()
        if not self._client or not self._collection:
            return 0
        results = self._collection.get(where={"agent_id": agent_id})
        count = len(results.get("ids", []))
        if count:
            self._collection.delete(ids=results["ids"])
        return count

    async def count(self, memory_type: Optional[MemoryType] = None) -> int:
        await self._ensure_client()
        if not self._client or not self._collection:
            return 0
        where = {}
        if memory_type:
            where["type"] = memory_type.value
        return self._collection.count() if not where else len(self._collection.get(where=where).get("ids", []))

    async def clear(self) -> None:
        await self._ensure_client()
        if not self._client or not self._collection:
            return
        self._client.delete_collection(self._collection_name)
        self._collection = self._client.get_or_create_collection(name=self._collection_name)

    async def close(self) -> None:
        self._client = None
        self._collection = None
