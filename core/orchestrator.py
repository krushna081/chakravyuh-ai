import asyncio
import logging
import signal
import uuid
from datetime import datetime
from typing import Any, Optional

from core.types import AgentConfig, AgentStatus, ProviderType, RouterMode, SystemState
from core.control_agent import ControlAgent
from core.base_agent import BaseAgent
from core.event_bus import get_event_bus

logger = logging.getLogger("chakravyuh.orchestrator")


class Orchestrator:
    def __init__(self, router_mode: RouterMode = RouterMode.LOCAL):
        self.router_mode = router_mode
        self._control_agent: Optional[ControlAgent] = None
        self._agents: dict[str, BaseAgent] = {}
        self._running = False
        self._start_time: Optional[datetime] = None
        self._event_bus = get_event_bus()
        self._ollama_connected = False
        self._ollama_models: list[str] = []

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._start_time = datetime.now()

        config = AgentConfig(
            id="control",
            name="Control Agent",
            role="Orchestrator & task delegator",
            system_prompt="You are the control agent responsible for decomposing tasks and assigning them to specialized agents.",
            provider=ProviderType.OLLAMA,
            model="llama3.1:8b",
            tools=[],
            capabilities=[],
            memory_scope=[],
            allowed_peers=[],
        )
        self._control_agent = ControlAgent(config)
        await self._control_agent.start()

        for agent in self._agents.values():
            await agent.start()
            self._control_agent.register_agent(agent)

        await self._event_bus.publish("orchestrator.started", {
            "agents": len(self._agents),
            "router_mode": self.router_mode.value,
        })
        logger.info(f"Orchestrator started with {len(self._agents)} agents")

    async def stop(self) -> None:
        self._running = False
        for agent in self._agents.values():
            await agent.stop()
        if self._control_agent:
            await self._control_agent.stop()
        await self._event_bus.publish("orchestrator.stopped", {})
        logger.info("Orchestrator stopped")

    def register_agent(self, agent: BaseAgent) -> None:
        self._agents[agent.id] = agent
        logger.info(f"Registered agent: {agent.name}")

    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        return self._agents.get(agent_id)

    def get_control_agent(self) -> Optional[ControlAgent]:
        return self._control_agent

    async def submit_task(self, task_description: str, priority: str = "medium") -> dict[str, Any]:
        if not self._control_agent:
            return {"status": "error", "error": "Orchestrator not started"}

        from core.types import MessagePriority
        priority_map = {"low": MessagePriority.LOW, "medium": MessagePriority.MEDIUM,
                        "high": MessagePriority.HIGH, "critical": MessagePriority.CRITICAL}

        msg = type('msg', (), {
            "id": uuid.uuid4().hex[:12],
            "from_agent": "user",
            "to_agent": "control",
            "type": "request",
            "priority": priority_map.get(priority, MessagePriority.MEDIUM),
            "payload": {"task": task_description, "data": {}},
            "metadata": {"timestamp": datetime.now().isoformat(), "trace_id": uuid.uuid4().hex[:12]},
        })()

        return await self._control_agent.handle_message(msg)

    def get_state(self) -> SystemState:
        uptime = "0s"
        if self._start_time:
            delta = datetime.now() - self._start_time
            hours, remainder = divmod(int(delta.total_seconds()), 3600)
            minutes, seconds = divmod(remainder, 60)
            uptime = f"{hours}h {minutes}m {seconds}s" if hours else f"{minutes}m {seconds}s"

        total = len(self._agents)
        active = sum(1 for a in self._agents.values() if a.status in (AgentStatus.ACTIVE, AgentStatus.PROCESSING))

        control = self._control_agent
        tasks_in_progress = len([t for t in (control._tasks.values() if control else []) if t.status.value == "in_progress"]) if control else 0

        return SystemState(
            engine_status="running" if self._running else "stopped",
            active_agents=active,
            total_agents=total + (1 if self._control_agent else 0),
            active_tasks=tasks_in_progress,
            queued_tasks=0,
            ollama_connected=self._ollama_connected,
            ollama_models=self._ollama_models,
            memory_usage="0 MB",
            uptime=uptime,
            router_mode=self.router_mode,
        )

    def set_ollama_status(self, connected: bool, models: list[str] | None = None) -> None:
        self._ollama_connected = connected
        if models is not None:
            self._ollama_models = models

    @property
    def agents(self) -> dict[str, BaseAgent]:
        return dict(self._agents)
