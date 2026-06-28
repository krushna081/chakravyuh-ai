import logging
from typing import Any, Optional

from core.base_agent import BaseAgent
from core.types import AgentMessage

logger = logging.getLogger("chakravyuh.agents.coordinator")


class CoordinatorAgent(BaseAgent):
    async def handle_message(self, message: AgentMessage) -> dict[str, Any]:
        task = message.payload.get("task", "")
        logger.info(f"Coordinator received task: {task[:100]}")

        if "plan" in task.lower() or "strategy" in task.lower():
            return await self._delegate("planner", task, message)
        elif "code" in task.lower() or "implement" in task.lower() or "write" in task.lower():
            return await self._delegate("coder", task, message)
        elif "research" in task.lower() or "search" in task.lower() or "find" in task.lower():
            return await self._delegate("researcher", task, message)
        elif "browse" in task.lower() or "navigate" in task.lower() or "scrape" in task.lower():
            return await self._delegate("browser", task, message)
        elif "test" in task.lower() or "qa" in task.lower() or "validate" in task.lower():
            return await self._delegate("qa", task, message)
        elif "deploy" in task.lower() or "release" in task.lower() or "build" in task.lower():
            return await self._delegate("deployment", task, message)
        elif "github" in task.lower() or "git" in task.lower() or "pr" in task.lower():
            return await self._delegate("github", task, message)
        elif "security" in task.lower() or "audit" in task.lower() or "vulnerability" in task.lower():
            return await self._delegate("security", task, message)
        else:
            return {
                "status": "unrecognized",
                "message": f"Could not classify task. Available agents: coordinator, planner, coder, researcher, browser, qa, memory_agent, security, github, deployment",
            }

    async def _delegate(self, target_agent_id: str, task: str, original_msg: AgentMessage) -> dict[str, Any]:
        from core.event_bus import get_event_bus
        bus = get_event_bus()
        await bus.publish(f"agent.{target_agent_id}.message", {
            "data": {
                "from_agent": self.id,
                "type": "request",
                "payload": {"task": task, "data": original_msg.payload.get("data", {})},
            }
        })
        return {"status": "delegated", "to": target_agent_id, "task": task[:100]}
