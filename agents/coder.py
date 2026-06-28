import logging
from typing import Any

from core.base_agent import BaseAgent
from core.types import AgentMessage

logger = logging.getLogger("chakravyuh.agents.coder")


class CoderAgent(BaseAgent):
    async def handle_message(self, message: AgentMessage) -> dict[str, Any]:
        task = message.payload.get("task", "")
        data = message.payload.get("data", {})
        logger.info(f"Coder working on: {task[:100]}")

        language = data.get("language", "python")
        framework = data.get("framework", "")

        return {
            "status": "code_generated",
            "language": language,
            "framework": framework or "none",
            "files_created": [],
            "summary": f"Code implementation for: {task[:80]}",
            "next_steps": ["Review generated code", "Run tests", "Commit to repository"],
        }
