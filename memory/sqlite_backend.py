import json
import sqlite3
import threading
from pathlib import Path
from typing import Optional
from datetime import datetime

from memory.interface import MemoryBackend
from core.types import MemoryEntry, MemoryQuery, MemoryType


class SQLiteBackend(MemoryBackend):
    def __init__(self, db_path: str = "data/memory.db"):
        self._db_path = Path(db_path)
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._local = threading.local()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        if not hasattr(self._local, "conn") or not self._local.conn:
            self._local.conn = sqlite3.connect(str(self._db_path))
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn

    def _init_db(self) -> None:
        conn = sqlite3.connect(str(self._db_path))
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id TEXT PRIMARY KEY,
                agent_id TEXT NOT NULL,
                type TEXT NOT NULL,
                content TEXT NOT NULL,
                metadata TEXT DEFAULT '{}',
                timestamp TEXT NOT NULL,
                embedding BLOB
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_memories_agent ON memories(agent_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_memories_type ON memories(type)")
        conn.commit()
        conn.close()

    async def store(self, entry: MemoryEntry) -> str:
        conn = self._get_conn()
        conn.execute(
            "INSERT OR REPLACE INTO memories (id, agent_id, type, content, metadata, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
            (entry.id, entry.agent_id, entry.type.value, entry.content,
             json.dumps(entry.metadata), entry.timestamp)
        )
        conn.commit()
        return entry.id

    async def retrieve(self, query: MemoryQuery) -> list[MemoryEntry]:
        conn = self._get_conn()
        sql = "SELECT * FROM memories WHERE 1=1"
        params = []

        if query.type:
            sql += " AND type = ?"
            params.append(query.type.value)
        if query.agent_id:
            sql += " AND agent_id = ?"
            params.append(query.agent_id)
        if query.query:
            sql += " AND content LIKE ?"
            params.append(f"%{query.query}%")

        sql += " ORDER BY timestamp DESC LIMIT ?"
        params.append(query.limit)

        rows = conn.execute(sql, params).fetchall()
        return [
            MemoryEntry(
                id=r["id"], agent_id=r["agent_id"],
                type=MemoryType(r["type"]), content=r["content"],
                metadata=json.loads(r["metadata"]), timestamp=r["timestamp"],
            )
            for r in rows
        ]

    async def delete(self, entry_id: str) -> bool:
        conn = self._get_conn()
        cur = conn.execute("DELETE FROM memories WHERE id = ?", (entry_id,))
        conn.commit()
        return cur.rowcount > 0

    async def delete_by_agent(self, agent_id: str) -> int:
        conn = self._get_conn()
        cur = conn.execute("DELETE FROM memories WHERE agent_id = ?", (agent_id,))
        conn.commit()
        return cur.rowcount

    async def count(self, memory_type: Optional[MemoryType] = None) -> int:
        conn = self._get_conn()
        if memory_type:
            row = conn.execute("SELECT COUNT(*) as c FROM memories WHERE type = ?", (memory_type.value,)).fetchone()
        else:
            row = conn.execute("SELECT COUNT(*) as c FROM memories").fetchone()
        return row["c"] if row else 0

    async def clear(self) -> None:
        conn = self._get_conn()
        conn.execute("DELETE FROM memories")
        conn.commit()

    async def close(self) -> None:
        if hasattr(self._local, "conn") and self._local.conn:
            self._local.conn.close()
            self._local.conn = None
