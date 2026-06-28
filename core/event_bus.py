import asyncio
import logging
from collections import defaultdict
from typing import Callable, Coroutine, Any
from datetime import datetime

logger = logging.getLogger("chakravyuh.event_bus")


class EventBus:
    def __init__(self):
        self._subscribers: dict[str, list[Callable]] = defaultdict(list)
        self._history: list[dict] = []
        self._max_history = 1000

    def subscribe(self, event_type: str, callback: Callable) -> None:
        self._subscribers[event_type].append(callback)
        logger.debug(f"Subscribed to {event_type}")

    def unsubscribe(self, event_type: str, callback: Callable) -> None:
        if callback in self._subscribers[event_type]:
            self._subscribers[event_type].remove(callback)

    async def publish(self, event_type: str, data: dict[str, Any] | None = None) -> None:
        entry = {
            "type": event_type,
            "data": data or {},
            "timestamp": datetime.now().isoformat(),
        }
        self._history.append(entry)
        if len(self._history) > self._max_history:
            self._history.pop(0)

        callbacks = self._subscribers.get(event_type, [])[:]
        wildcard = self._subscribers.get("*", [])[:]

        for cb in callbacks + wildcard:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(entry)
                else:
                    cb(entry)
            except Exception as e:
                logger.error(f"EventBus callback error for {event_type}: {e}")

    def get_history(self, event_type: str | None = None, limit: int = 50) -> list[dict]:
        if event_type:
            return [e for e in self._history if e["type"] == event_type][-limit:]
        return self._history[-limit:]

    def clear(self) -> None:
        self._history.clear()
        self._subscribers.clear()


_event_bus_instance: EventBus | None = None


def get_event_bus() -> EventBus:
    global _event_bus_instance
    if _event_bus_instance is None:
        _event_bus_instance = EventBus()
    return _event_bus_instance
