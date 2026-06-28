import asyncio
import logging
import shlex

from tools.base import BaseTool, ToolResult

logger = logging.getLogger("chakravyuh.tools.terminal")


class TerminalTool(BaseTool):
    name = "terminal"
    description = "Execute shell commands"

    ALLOWED_COMMANDS = {
        "ls", "cat", "head", "tail", "grep", "find", "wc", "echo",
        "python", "node", "npm", "pip", "git", "docker",
        "mkdir", "cp", "mv", "rm", "touch", "chmod",
        "ps", "top", "df", "du", "uname", "whoami", "pwd",
        "curl", "wget",
    }

    async def execute(self, command: str = "", **kwargs) -> ToolResult:
        if not command:
            return ToolResult(success=False, error="Command is required")

        cmd_parts = shlex.split(command)
        if cmd_parts and cmd_parts[0] not in self.ALLOWED_COMMANDS:
            return ToolResult(success=False, error=f"Command not allowed: {cmd_parts[0]}")

        try:
            proc = await asyncio.create_subprocess_shell(
                command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=30)
            exit_code = proc.returncode or 0
            return ToolResult(success=exit_code == 0, data={
                "command": command,
                "exit_code": exit_code,
                "stdout": stdout.decode(errors="replace")[:5000],
                "stderr": stderr.decode(errors="replace")[:2000],
            })
        except asyncio.TimeoutError:
            return ToolResult(success=False, error="Command timed out (30s)")
        except Exception as e:
            return ToolResult(success=False, error=str(e))
