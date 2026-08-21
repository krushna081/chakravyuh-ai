import asyncio
import json
import logging
import re
import uuid
from datetime import datetime
from typing import Any, Optional

from core.types import (
    AgentConfig, AgentStatus, AgentMessage, MessagePriority,
    TaskStatus, WorkflowStep, MemoryType,
)
from core.base_agent import BaseAgent
from core.event_bus import get_event_bus
from core.task_store import get_task_store
from core import llm

logger = logging.getLogger("chakravyuh.control")

_PLAN_RE = re.compile(r'(\{.*?\})', re.DOTALL)

_KEYWORD_MAP = {
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


class ControlAgent(BaseAgent):
    """Orchestrator: decomposes tasks, assigns real steps, records the ledger."""

    def __init__(self, config: AgentConfig):
        super().__init__(config)
        self._agents: dict[str, BaseAgent] = {}
        self._tasks: dict[str, Any] = {}
        self._workflows: dict[str, Any] = {}
        self._tasks_store = get_task_store()

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

    # ── entry points ──────────────────────────────────────────────────

    async def handle_message(self, message: AgentMessage) -> dict[str, Any]:
        if message.type == "request":
            return await self._process_request(message)
        return {"status": "ignored", "reason": "unexpected_message_type"}

    async def _process_request(self, message: AgentMessage) -> dict[str, Any]:
        task_desc = message.payload.get("task", "")
        task_id = self._tasks_store.create(task_desc, message.priority.name.lower())
        self._tasks[task_id] = {"id": task_id, "description": task_desc}

        await self._event_bus.publish("task.created", {
            "task_id": task_id,
            "description": task_desc,
            "priority": message.priority.name,
        })

        return await self._run_task(
            task_id,
            task_desc,
            message.priority.name.lower(),
            message.metadata.get("trace_id", ""),
            message,
        )

    async def submit_async(self, task_desc: str, priority: str = "medium") -> dict[str, Any]:
        """Queue a task and run it in the background (POST /api/v1/tasks)."""
        task_id = self._tasks_store.create(task_desc, priority)
        self._tasks[task_id] = {"id": task_id, "description": task_desc}
        await self._event_bus.publish("task.created", {
            "task_id": task_id,
            "description": task_desc,
            "priority": priority,
        })
        asyncio.get_running_loop().create_task(self._run_task(task_id, task_desc, priority, "", None))
        return {"task_id": task_id, "status": "queued", "description": task_desc}

    # ── the real execution ────────────────────────────────────────────

    async def _run_task(
        self,
        task_id: str,
        task_desc: str,
        priority: str,
        trace_id: str,
        original_msg: Optional[AgentMessage],
    ) -> dict[str, Any]:
        self._tasks_store.update(task_id, status="running", started_at=datetime.now().isoformat())
        self.status = AgentStatus.PROCESSING
        try:
            plan = await self._decompose_task(task_desc)
            if not plan:
                self._tasks_store.update(
                    task_id, status="failed", error="Could not decompose task into steps.",
                    completed_at=datetime.now().isoformat(),
                )
                return {"status": "failed", "task_id": task_id, "error": "Could not decompose task"}

            results: list[dict] = []
            for step in plan:
                self._tasks_store.update(task_id, steps=results)
                step_result = await self._assign_and_execute(step, priority, trace_id)
                results.append(step_result)

            self._tasks_store.update(task_id, steps=results)
            ok = all(r.get("status") == "completed" for r in results)
            final_status = "completed" if ok else "failed"
            self._tasks_store.update(
                task_id,
                status=final_status,
                result={"results": results},
                error=None if ok else "One or more steps failed",
                completed_at=datetime.now().isoformat(),
            )
            await self.store_memory(
                MemoryType.EPISODIC,
                f"[control] {task_desc[:200]} → {final_status}",
                {"task_id": task_id, "steps": len(plan)},
            )
            return {
                "status": final_status,
                "task_id": task_id,
                "results": results,
            }
        except Exception as e:
            logger.error(f"Task {task_id} crashed: {e}")
            self._tasks_store.update(
                task_id, status="failed", error=str(e),
                completed_at=datetime.now().isoformat(),
            )
            return {"status": "failed", "task_id": task_id, "error": str(e)}
        finally:
            self.status = AgentStatus.IDLE

    async def _decompose_task(self, task_desc: str) -> list[WorkflowStep]:
        """Real LLM decomposition when available; honest keyword fallback otherwise."""
        steps: list[WorkflowStep] = []
        used: set[str] = set()

        def add_step(agent_id: str, description: str) -> None:
            if agent_id in self._agents and agent_id not in used:
                steps.append(WorkflowStep(
                    id=uuid.uuid4().hex[:12],
                    agent_id=agent_id,
                    task_description=description,
                    input_data={},
                ))
                used.add(agent_id)

        # 1) try the LLM for a real plan
        if llm.available() and llm.has_model(self.config.model):
            try:
                plan_text = await llm.complete(
                    self.config.model,
                    (
                        "You are the control agent. Decompose the user's task into a plan of steps. "
                        "Reply ONLY with a JSON array of objects: [{\"agent\": \"<one of: "
                        f"{', '.join(sorted(self._agents.keys()))}>\", \"task\": \"<concise step for that agent>\"}}]. "
                        "Pick 1-4 steps; use agents that fit the work; prefer the most specific agent."
                    ),
                    task_desc,
                )
                if plan_text:
                    m = _PLAN_RE.search(plan_text)
                    if m:
                        parsed = json.loads(m.group(1))
                        if isinstance(parsed, list):
                            for item in parsed[:4]:
                                if isinstance(item, dict):
                                    add_step(str(item.get("agent", "")), str(item.get("task", ""))[:300])
            except Exception as e:
                logger.warning(f"LLM decomposition failed, using keyword router: {e}")

        # 2) keyword fallback / complement
        if not steps:
            for keyword, agent_id in _KEYWORD_MAP.items():
                if keyword in task_desc.lower():
                    add_step(agent_id, f"{agent_id.replace('_', ' ').title()}: {task_desc}")
        if not steps:
            add_step("coordinator", task_desc)

        for i, step in enumerate(steps):
            if i > 0:
                step.depends_on = [steps[i - 1].id]
        return steps

    async def _assign_and_execute(
        self,
        step: WorkflowStep,
        priority: str,
        trace_id: str,
    ) -> dict[str, Any]:
        agent = self._agents.get(step.agent_id)
        if not agent:
            return {"step_id": step.id, "status": "failed", "agent": step.agent_id,
                    "error": f"Agent '{step.agent_id}' not registered"}

        priority_map = {"low": MessagePriority.LOW, "medium": MessagePriority.MEDIUM,
                        "high": MessagePriority.HIGH, "critical": MessagePriority.CRITICAL}
        msg = AgentMessage(
            id=uuid.uuid4().hex[:12],
            from_agent=self.id,
            to_agent=agent.id,
            type="request",
            priority=priority_map.get(priority, MessagePriority.MEDIUM),
            payload={"task": step.task_description, "data": step.input_data},
            metadata={"timestamp": datetime.now().isoformat(), "trace_id": trace_id},
        )

        await self._event_bus.publish("step.assigned", {
            "step_id": step.id,
            "agent_id": agent.id,
            "task": step.task_description,
        })

        step.status = TaskStatus.IN_PROGRESS
        result = await agent.send_and_wait(msg, timeout=600.0)
        if not result:
            step.status = TaskStatus.FAILED
            return {"step_id": step.id, "status": "failed", "agent": agent.id,
                    "error": "Agent returned no result"}
        if result.get("status") == "error":
            step.status = TaskStatus.FAILED
        else:
            step.status = TaskStatus.COMPLETED
        return {
            "step_id": step.id,
            "status": "completed" if step.status == TaskStatus.COMPLETED else "failed",
            "agent": agent.id,
            "response": result.get("response", ""),
            "error": result.get("error"),
            "steps": result.get("steps", []),
        }

    def get_status_summary(self) -> dict[str, Any]:
        tasks = self._tasks_store.list(limit=50)
        return {
            "control_agent": self.status.value,
            "registered_agents": len(self._agents),
            "tasks": tasks,
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