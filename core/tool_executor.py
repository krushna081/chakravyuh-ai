"""Tool executor — the only path agents use to touch the outside world.

Every tool is resolved by name, executed with strict kwargs, and returns a
ToolResult. Failures are honest: if a tool is not configured (e.g. GitHub
token missing, MCP server not running), the agent sees a real error message,
never a fabricated success.
"""
import logging
import os
from typing import Any, Optional

from tools.base import BaseTool, ToolResult
from tools.filesystem import FilesystemTool
from tools.web_search import WebSearchTool
from tools.web_fetch import WebFetchTool
from tools.terminal import TerminalTool
from tools.github import GitHubTool
from tools.docker import DockerTool

logger = logging.getLogger("chakravyuh.tools")

TOOL_NAME_TO_CLASS: dict[str, type[BaseTool]] = {
    "filesystem": FilesystemTool,
    "web_search": WebSearchTool,
    "web_fetch": WebFetchTool,
    "terminal": TerminalTool,
    "github": GitHubTool,
    "docker": DockerTool,
}

ALL_TOOLS = sorted(TOOL_NAME_TO_CLASS.keys())


class ToolExecutor:
    def __init__(self) -> None:
        self._instances: dict[str, BaseTool] = {}

    def _get(self, name: str) -> Optional[BaseTool]:
        if name not in TOOL_NAME_TO_CLASS:
            return None
        if name not in self._instances:
            self._instances[name] = TOOL_NAME_TO_CLASS[name]()
        return self._instances[name]

    async def execute(self, name: str, agent_id: str, kwargs: dict[str, Any]) -> ToolResult:
        tool = self._get(name)
        if tool is None:
            return ToolResult(success=False, error=f"Unknown tool '{name}'. Available: {', '.join(ALL_TOOLS)}")
        if name == "github" and not os.getenv("GITHUB_TOKEN"):
            return ToolResult(
                success=False,
                error="GitHub tool is not configured — set GITHUB_TOKEN in the environment (never commit it).",
            )
        try:
            result = await tool.execute(**kwargs)
            return result
        except TypeError as e:
            return ToolResult(success=False, error=f"Bad arguments for {name}: {e}")
        except Exception as e:
            logger.error(f"Tool {name} crashed: {e}")
            return ToolResult(success=False, error=f"{name} failed: {e}")

    def availability(self) -> list[dict[str, str]]:
        """Integration status for the readiness UI (no secrets, names only)."""
        checks = [
            {
                "name": "GitHub API",
                "purpose": "Issue/PR/commit automation for the GitHub agent",
                "required": False,
                "free": True,
                "status": "connected" if os.getenv("GITHUB_TOKEN") else "not_configured",
                "reason": "" if os.getenv("GITHUB_TOKEN") else "GITHUB_TOKEN not set",
                "config_var": "GITHUB_TOKEN",
                "alternative": "Create a fine-grained PAT at github.com/settings/tokens; the GitHub agent stays idle without it.",
            },
            {
                "name": "Docker",
                "purpose": "Container build/run for the Deployment agent",
                "required": False,
                "free": True,
                "status": "connected" if os.getenv("DOCKER_HOST") else "not_configured",
                "reason": "" if os.getenv("DOCKER_HOST") else "DOCKER_HOST not set (defaults to local socket)",
                "config_var": "DOCKER_HOST",
                "alternative": "Install Docker or set DOCKER_HOST to a reachable daemon.",
            },
            {
                "name": "Web Search (DuckDuckGo)",
                "purpose": "Free, key-less web search for the Researcher agent",
                "required": False,
                "free": True,
                "status": "available",
                "reason": "No API key required",
                "config_var": "none",
                "alternative": "none",
            },
            {
                "name": "Web Fetch (httpx)",
                "purpose": "Page/content retrieval for the Researcher agent",
                "required": False,
                "free": True,
                "status": "available",
                "reason": "No API key required",
                "config_var": "none",
                "alternative": "none",
            },
            {
                "name": "Filesystem (sandboxed)",
                "purpose": "Read/write within the agent workspace only",
                "required": True,
                "free": True,
                "status": "connected",
                "reason": f"Workspace: {os.getenv('CHAKRAVYUH_WORKSPACE', 'data/workspace')}",
                "config_var": "CHAKRAVYUH_WORKSPACE",
                "alternative": "none",
            },
        ]
        return checks


_executor: Optional[ToolExecutor] = None


def get_executor() -> ToolExecutor:
    global _executor
    if _executor is None:
        _executor = ToolExecutor()
    return _executor