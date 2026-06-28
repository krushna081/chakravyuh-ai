import asyncio
import logging
import uuid
from typing import Any, Optional
from datetime import datetime

from core.types import (
    AgentConfig, AgentStatus, AgentMessage, MessagePriority,
    MemoryEntry, MemoryType, AgentCapability
)
from core.event_bus import get_event_bus

logger = logging.getLogger("chakravyuh.agent")


class BaseAgent:
    def __init__(self, config: AgentConfig):
        self.config = config
        self.status = AgentStatus.IDLE
        self._task_queue: asyncio.Queue[AgentMessage] = asyncio.Queue()
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
        self._event_bus = get_event_bus()
        self._consecutive_calls = 0
        self._start_time: Optional[datetime] = None

        self._event_bus.subscribe(f"agent.{config.id}.message", self._on_message)

    @property
    def id(self) -> str:
        return self.config.id

    @property
    def name(self) -> str:
        return self.config.name

    @property
    def role(self) -> str:
        return self.config.role

    @property
    def capabilities(self) -> list[AgentCapability]:
        return self.config.capabilities

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._start_time = datetime.now()
        self._worker_task = asyncio.create_task(self._worker_loop())
        self.status = AgentStatus.IDLE
        await self._event_bus.publish("agent.started", {
            "agent_id": self.id, "agent_name": self.name
        })
        logger.info(f"Agent {self.name} ({self.id}) started")

    async def stop(self) -> None:
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        self.status = AgentStatus.IDLE
        await self._event_bus.publish("agent.stopped", {
            "agent_id": self.id, "agent_name": self.name
        })
        logger.info(f"Agent {self.name} ({self.id}) stopped")

    async def send_message(self, message: AgentMessage) -> None:
        await self._task_queue.put(message)

    async def _on_message(self, event: dict) -> None:
        pass

    async def _worker_loop(self) -> None:
        while self._running:
            try:
                message = await asyncio.wait_for(
                    self._task_queue.get(), timeout=1.0
                )
                self.status = AgentStatus.ACTIVE
                try:
                    await self._event_bus.publish("agent.task_started", {
                        "agent_id": self.id,
                        "message_id": message.id,
                        "type": message.type,
                    })
                    response = await self.handle_message(message)
                    if response:
                        await self._event_bus.publish(
                            f"agent.{message.from_agent}.message",
                            {"data": response}
                        )
                    await self._event_bus.publish("agent.task_completed", {
                        "agent_id": self.id,
                        "message_id": message.id,
                    })
                except Exception as e:
                    logger.error(f"Agent {self.id} error: {e}")
                    self.status = AgentStatus.ERROR
                    await self._event_bus.publish("agent.error", {
                        "agent_id": self.id, "error": str(e)
                    })
                    await asyncio.sleep(2)
                    self.status = AgentStatus.IDLE
                finally:
                    self._task_queue.task_done()
                self._consecutive_calls = 0
            except asyncio.TimeoutError:
                if self._consecutive_calls > self.config.max_consecutive_calls:
                    self.status = AgentStatus.SLEEPING
                    await asyncio.sleep(5)
                    self.status = AgentStatus.IDLE
                    self._consecutive_calls = 0
                if self.status == AgentStatus.ACTIVE or self.status == AgentStatus.PROCESSING:
                    self.status = AgentStatus.IDLE
            except asyncio.CancelledError:
                break

    async def handle_message(self, message: AgentMessage) -> Optional[dict[str, Any]]:
        raise NotImplementedError("Subclasses must implement handle_message")

    async def emit(self, event_type: str, data: dict[str, Any]) -> None:
        await self._event_bus.publish(event_type, data)

    def reply(self, original: AgentMessage, data: dict[str, Any]) -> AgentMessage:
        return AgentMessage(
            id=uuid.uuid4().hex[:12],
            from_agent=self.id,
            to_agent=original.from_agent,
            type="response",
            priority=original.priority,
            payload=data,
            metadata={"timestamp": datetime.now().isoformat(), "trace_id": original.metadata.get("trace_id", "")},
        )

    async def store_memory(self, memory_type: MemoryType, content: str, metadata: dict | None = None) -> None:
        entry = MemoryEntry(
            id=uuid.uuid4().hex[:12],
            agent_id=self.id,
            type=memory_type,
            content=content,
            metadata=metadata or {},
        )
        await self._event_bus.publish("memory.store", {
            "entry": entry.__dict__
        })

    def get_uptime(self) -> str:
        if not self._start_time:
            return "0s"
        delta = datetime.now() - self._start_time
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        if hours > 0:
            return f"{hours}h {minutes}m"
        if minutes > 0:
            return f"{minutes}m {seconds}s"
        return f"{seconds}s"
