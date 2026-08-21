"""Per-agent session logs — the live record of each agent's work.

Every line an agent produces (prompts, tool calls, tool results, final
responses, errors) is appended here, kept in a ring buffer for fast reads,
and persisted to SQLite so sessions survive restarts.
"""
import json
import logging
import os
import sqlite3
import threading
from collections import defaultdict, deque
from datetime import datetime

logger = logging.getLogger("chakravyuh.session")

_CAP = 600


def _db_path() -> str:
    base = os.getenv("CHAKRAVYUH_SQLITE_PATH", "data/memory.db")
    return base


class SessionStore:
    def __init__(self) -> None:
        self._rings: dict[str, deque[str]] = defaultdict(lambda: deque(maxlen=_CAP))
        self._lock = threading.Lock()
        self._conn: sqlite3.Connection | None = None
        self._init_db()

    def _init_db(self) -> None:
        try:
            path = _db_path()
            os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
            self._conn = sqlite3.connect(path, check_same_thread=False)
            self._conn.execute(
                """CREATE TABLE IF NOT EXISTS agent_sessions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    agent_id TEXT NOT NULL,
                    line TEXT NOT NULL,
                    ts TEXT NOT NULL
                )"""
            )
            self._conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_sessions_agent ON agent_sessions(agent_id, id)"
            )
            self._conn.commit()
        except Exception as e:  # pragma: no cover - db may be read-only
            logger.warning(f"Session persistence unavailable: {e}")
            self._conn = None

    def append(self, agent_id: str, line: str) -> None:
        with self._lock:
            self._rings[agent_id].append(line)
        if self._conn:
            try:
                self._conn.execute(
                    "INSERT INTO agent_sessions (agent_id, line, ts) VALUES (?, ?, ?)",
                    (agent_id, line, datetime.now().isoformat()),
                )
                self._conn.commit()
            except Exception:
                pass

    def lines(self, agent_id: str, limit: int = 400) -> list[str]:
        with self._lock:
            return list(self._rings[agent_id])[-limit:]

    def persisted_lines(self, agent_id: str, limit: int = 400) -> list[str]:
        if not self._conn:
            return []
        try:
            cur = self._conn.execute(
                "SELECT line FROM agent_sessions WHERE agent_id = ? ORDER BY id DESC LIMIT ?",
                (agent_id, limit),
            )
            rows = cur.fetchall()
            return [r[0] for r in reversed(rows)]
        except Exception:
            return []


def get_session_store() -> SessionStore:
    global _store
    if _store is None:
        _store = SessionStore()
    return _store


_store: SessionStore | None = None