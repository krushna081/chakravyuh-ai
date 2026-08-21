"""SQLite-backed task ledger — real task lifecycle records.

Every submitted task moves through a real state machine:
    queued → running → completed | failed
with per-step results and honest error messages. The web UI polls this
ledger so the dashboard reflects what the backend is actually doing.
"""
import json
import logging
import os
import sqlite3
import threading
import uuid
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger("chakravyuh.task_store")


class TaskStore:
    def __init__(self) -> None:
        path = os.getenv("CHAKRAVYUH_SQLITE_PATH", "data/memory.db")
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.execute(
            """CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                description TEXT NOT NULL,
                priority TEXT NOT NULL DEFAULT 'medium',
                status TEXT NOT NULL DEFAULT 'queued',
                created_at TEXT NOT NULL,
                started_at TEXT,
                completed_at TEXT,
                error TEXT,
                steps TEXT,
                result TEXT
            )"""
        )
        self._conn.commit()

    def _row_to_task(self, row) -> dict[str, Any]:
        return {
            "id": row[0],
            "description": row[1],
            "priority": row[2],
            "status": row[3],
            "created_at": row[4],
            "started_at": row[5],
            "completed_at": row[6],
            "error": row[7],
            "steps": json.loads(row[8]) if row[8] else [],
            "result": json.loads(row[9]) if row[9] else None,
        }

    def create(self, description: str, priority: str = "medium") -> str:
        task_id = uuid.uuid4().hex[:12]
        with self._lock:
            self._conn.execute(
                "INSERT INTO tasks (id, description, priority, status, created_at) VALUES (?, ?, ?, 'queued', ?)",
                (task_id, description, priority, datetime.now().isoformat()),
            )
            self._conn.commit()
        return task_id

    def update(self, task_id: str, **fields: Any) -> None:
        allowed = {"status", "started_at", "completed_at", "error", "steps", "result"}
        sets = {k: v for k, v in fields.items() if k in allowed}
        if not sets:
            return
        sets["result_json"] = json.dumps(sets.pop("result")) if "result" in sets else None
        sets["steps_json"] = json.dumps(sets.pop("steps")) if "steps" in sets else None
        cols = []
        vals = []
        for k, v in sets.items():
            if v is None and k in ("result_json", "steps_json"):
                continue
            cols.append(k.replace("result_json", "result").replace("steps_json", "steps"))
            vals.append(v)
        with self._lock:
            self._conn.execute(
                f"UPDATE tasks SET {', '.join(f'{c} = ?' for c in cols)} WHERE id = ?",
                (*vals, task_id),
            )
            self._conn.commit()

    def get(self, task_id: str) -> Optional[dict[str, Any]]:
        with self._lock:
            row = self._conn.execute(
                "SELECT * FROM tasks WHERE id = ?", (task_id,)
            ).fetchone()
        return self._row_to_task(row) if row else None

    def list(self, limit: int = 100) -> list[dict[str, Any]]:
        with self._lock:
            rows = self._conn.execute(
                "SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
        return [self._row_to_task(r) for r in rows]


_store: TaskStore | None = None


def get_task_store() -> TaskStore:
    global _store
    if _store is None:
        _store = TaskStore()
    return _store