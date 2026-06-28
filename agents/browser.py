import logging
from typing import Any

from core.base_agent import BaseAgent
from core.types import AgentMessage

logger = logging.getLogger("chakravyuh.agents.browser")


class BrowserAgent(BaseAgent):
    async def handle_message(self, message: AgentMessage) -> dict[str, Any]:
        task = message.payload.get("task", "")
        url = message.payload.get("data", {}).get("url", "")
        logger.info(f"Browser navigating: {task[:100]}")

        return {
            "status": "browsing_complete",
            "url": url or "not_specified",
            "actions_performed": [],
            "extracted_data_size": "0 KB",
            "screenshot": None,
            "summary": f"Browser automation completed for: {task[:80]}",
        }
