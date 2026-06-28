import asyncio
import logging
import uuid
from typing import Any, Optional
from datetime import datetime

from core.types import (
    AgentConfig, AgentStatus, AgentMessage, MessagePriority,
    Task, TaskStatus, Workflow, WorkflowStep, AgentCapability
)
from core.base_agent import BaseAgent
from core.event_bus import get_event_bus

logger = logging.getLogger("chakravyuh.control")


class ControlAgent(BaseAgent):
    def __init__(self, config: AgentConfig):
        super().__init__(config)
        self._agents: dict[str, BaseAgent] = {}
        self._tasks: dict[str, Task] = {}
        self._workflows: dict[str, Workflow] = {}
        self._pending_queue: asyncio.Queue = asyncio.Queue()

    def register_agent(self, agent: BaseAgent) -> None:
        self._agents[agent.id] = agent
        logger.info(f"Registered agent: {agent.name} ({agent.id})")

    def unregister_agent(self, agent_id: str) -> None:
        self._agents.pop(agent_id, None)

    def get_agent(self, agent_id: str) -> Optional[BaseAgent]:
        return self._agents.get(agent_id)

    @property
    def registered_agents(self) -> dict[str, BaseAgent]:
        return dict(self._agents)

    async def handle_message(self, message: AgentMessage) -> dict[str, Any]:
        if message.type == "request":
            return await self._process_request(message)
        return {"status": "ignored", "reason": "unexpected_message_type"}

    async def _process_request(self, message: AgentMessage) -> dict[str, Any]:
        task_desc = message.payload.get("task", "")
        task_id = uuid.uuid4().hex[:12]

        task = Task(
            id=task_id,
            description=task_desc,
            priority=message.priority,
            input_data=message.payload.get("data", {}),
        )
        self._tasks[task_id] = task

        await self._event_bus.publish("task.created", {
            "task_id": task_id,
            "description": task_desc,
            "priority": message.priority.name,
        })

        plan = await self._decompose_task(task)
        task.subtasks = [s.id for s in plan]

        if not plan:
            task.status = TaskStatus.FAILED
            task.error = "Could not decompose task"
            return {"status": "failed", "error": task.error}

        results = []
        for step in plan:
            step_result = await self._assign_and_execute(step, message)
            results.append(step_result)

        task.status = TaskStatus.COMPLETED
        task.completed_at = datetime.now().isoformat()

        await self.store_memory(
            "episodic",
            f"Completed task: {task_desc}",
            {"task_id": task_id, "steps": len(plan)}
        )

        return {
            "status": "completed",
            "task_id": task_id,
            "results": results,
        }

    async def _decompose_task(self, task: Task) -> list[WorkflowStep]:
        if not self._agents:
            return []

        steps = []
        task_lower = task.description.lower()
        used_agents: set[str] = set()

        agent_map = {
            "plan": "planner",
            "research": "researcher",
            "search": "researcher",
            "code": "coder",
            "implement": "coder",
            "write": "coder",
            "test": "qa",
            "qa": "qa",
            "browse": "browser",
            "deploy": "deployment",
            "release": "deployment",
            "github": "github",
            "git": "github",
            "pr": "github",
            "security": "security",
            "audit": "security",
            "memory": "memory_agent",
            "remember": "memory_agent",
        }

        for keyword, agent_id in agent_map.items():
            if keyword in task_lower and agent_id in self._agents:
                if agent_id not in used_agents:
                    steps.append(WorkflowStep(
                        id=uuid.uuid4().hex[:12],
                        agent_id=agent_id,
                        task_description=f"{agent_id.replace('_', ' ').title()}: {task.description}",
                        input_data=task.input_data,
                    ))
                    used_agents.add(agent_id)

        if not steps:
            coordinator = self._agents.get("coordinator")
            if coordinator:
                steps.append(WorkflowStep(
                    id=uuid.uuid4().hex[:12],
                    agent_id="coordinator",
                    task_description=task.description,
                    input_data=task.input_data,
                ))

        for i, step in enumerate(steps):
            if i > 0:
                step.depends_on = [steps[i - 1].id]

        return steps

    async def _assign_and_execute(self, step: WorkflowStep, original_msg: AgentMessage) -> dict[str, Any]:
        agent = self._agents.get(step.agent_id)
        if not agent:
            return {"step_id": step.id, "status": "failed", "error": f"Agent {step.agent_id} not found"}

        msg = AgentMessage(
            id=uuid.uuid4().hex[:12],
            from_agent=self.id,
            to_agent=agent.id,
            type="request",
            priority=original_msg.priority,
            payload={"task": step.task_description, "data": step.input_data},
            metadata={"timestamp": datetime.now().isoformat(), "trace_id": original_msg.metadata.get("trace_id", "")},
        )

        await self._event_bus.publish("step.assigned", {
            "step_id": step.id,
            "agent_id": agent.id,
            "task": step.task_description,
        })

        try:
            await asyncio.wait_for(agent.send_message(msg), timeout=30.0)
            step.status = TaskStatus.IN_PROGRESS
            return {"step_id": step.id, "status": "assigned", "agent": agent.id}
        except asyncio.TimeoutError:
            step.status = TaskStatus.FAILED
            return {"step_id": step.id, "status": "failed", "error": "Agent unresponsive"}

    def get_status_summary(self) -> dict[str, Any]:
        return {
            "control_agent": self.status.value,
            "registered_agents": len(self._agents),
            "active_tasks": len([t for t in self._tasks.values() if t.status == TaskStatus.IN_PROGRESS]),
            "pending_tasks": len([t for t in self._tasks.values() if t.status == TaskStatus.PENDING]),
            "completed_tasks": len([t for t in self._tasks.values() if t.status == TaskStatus.COMPLETED]),
            "failed_tasks": len([t for t in self._tasks.values() if t.status == TaskStatus.FAILED]),
            "active_workflows": len(self._workflows),
            "uptime": self.get_uptime(),
            "agents": {
                aid: {
                    "name": a.name,
                    "status": a.status.value,
                    "role": a.role,
                    "uptime": a.get_uptime(),
                }
                for aid, a in self._agents.items()
            },
        }
