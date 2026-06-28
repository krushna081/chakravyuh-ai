import logging
from typing import Any

from core.base_agent import BaseAgent
from core.types import AgentMessage

logger = logging.getLogger("chakravyuh.agents.researcher")


class ResearcherAgent(BaseAgent):
    async def handle_message(self, message: AgentMessage) -> dict[str, Any]:
        task = message.payload.get("task", "")
        logger.info(f"Researcher investigating: {task[:100]}")

        return {
            "status": "research_complete",
            "query": task[:200],
            "sources_found": 0,
            "findings_summary": f"Research findings for: {task[:80]}",
            "confidence": 0.85,
            "suggested_followups": ["Deep dive into specific aspects", "Cross-reference with other sources"],
        }
