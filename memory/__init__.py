from memory.interface import MemoryBackend
from memory.in_memory import InMemoryBackend
from memory.sqlite_backend import SQLiteBackend
from memory.chroma_backend import ChromaBackend


def create_memory_backend(backend_type: str = "in_memory", **kwargs):
    backends = {
        "in_memory": InMemoryBackend,
        "sqlite": SQLiteBackend,
        "chroma": ChromaBackend,
    }
    cls = backends.get(backend_type)
    if cls:
        return cls(**kwargs)
    return InMemoryBackend(**kwargs)


__all__ = [
    "MemoryBackend", "InMemoryBackend", "SQLiteBackend", "ChromaBackend",
    "create_memory_backend",
]
