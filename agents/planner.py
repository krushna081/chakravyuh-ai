import logging
from typing import Any

from core.base_agent import BaseAgent
from core.types import AgentMessage

logger = logging.getLogger("chakravyuh.agents.planner")


class PlannerAgent(BaseAgent):
    async def handle_message(self, message: AgentMessage) -> dict[str, Any]:
        task = message.payload.get("task", "")
        logger.info(f"Planner analyzing: {task[:100]}")

        plan_steps = []
        task_lower = task.lower()

        if "research" in task_lower or "search" in task_lower:
            plan_steps.append("1. Define research questions and scope")
            plan_steps.append("2. Search for relevant information")
            plan_steps.append("3. Synthesize findings into summary")
        if "code" in task_lower or "implement" in task_lower or "write" in task_lower:
            plan_steps.append("1. Analyze requirements and existing code")
            plan_steps.append("2. Design architecture and component breakdown")
            plan_steps.append("3. Implement core functionality")
            plan_steps.append("4. Write tests for the implementation")
            plan_steps.append("5. Review and refactor for quality")
        if "deploy" in task_lower or "release" in task_lower:
            plan_steps.append("1. Build and run tests")
            plan_steps.append("2. Create deployment package")
            plan_steps.append("3. Configure deployment environment")
            plan_steps.append("4. Deploy and verify health")
        if "test" in task_lower or "qa" in task_lower:
            plan_steps.append("1. Review requirements and existing tests")
            plan_steps.append("2. Design test cases covering edge cases")
            plan_steps.append("3. Execute test suite")
            plan_steps.append("4. Report results and track regressions")
        if not plan_steps:
            plan_steps = [
                "1. Analyze and understand the requirements",
                "2. Break down into actionable subtasks",
                "3. Assign subtasks to appropriate agents",
                "4. Monitor execution and handle edge cases",
                "5. Verify completion and summarize results",
            ]

        return {
            "status": "planned",
            "plan": plan_steps,
            "estimated_steps": len(plan_steps),
        }
