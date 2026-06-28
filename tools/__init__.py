from tools.base import BaseTool, ToolResult
from tools.mcp_client import MCPClient
from tools.filesystem import FilesystemTool
from tools.web_fetch import WebFetchTool
from tools.web_search import WebSearchTool
from tools.terminal import TerminalTool
from tools.github import GitHubTool
from tools.docker import DockerTool

TOOL_REGISTRY: dict[str, type[BaseTool]] = {
    "filesystem": FilesystemTool,
    "web_fetch": WebFetchTool,
    "web_search": WebSearchTool,
    "terminal": TerminalTool,
    "github": GitHubTool,
    "docker": DockerTool,
}


async def get_tool(name: str) -> BaseTool | None:
    cls = TOOL_REGISTRY.get(name)
    if cls:
        return cls()
    return None


async def execute_tool(name: str, params: dict | None = None) -> ToolResult:
    tool = await get_tool(name)
    if not tool:
        return ToolResult(success=False, error=f"Tool '{name}' not found")
    return await tool.execute(**(params or {}))


__all__ = [
    "BaseTool", "ToolResult", "MCPClient",
    "FilesystemTool", "WebFetchTool", "WebSearchTool",
    "TerminalTool", "GitHubTool", "DockerTool",
    "TOOL_REGISTRY", "get_tool", "execute_tool",
]
