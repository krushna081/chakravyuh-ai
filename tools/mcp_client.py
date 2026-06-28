import asyncio
import json
import logging
import subprocess
from typing import Any

logger = logging.getLogger("chakravyuh.tools.mcp")


class MCPClient:
    def __init__(self, server_command: str | list[str], server_args: list[str] | None = None):
        self._cmd = server_command if isinstance(server_command, list) else [server_command]
        if server_args:
            self._cmd.extend(server_args)
        self._process: subprocess.Popen | None = None
        self._request_id = 0
        self._pending: dict[int, asyncio.Future] = {}

    async def start(self) -> None:
        self._process = await asyncio.create_subprocess_exec(
            *self._cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        asyncio.create_task(self._read_loop())
        logger.info(f"MCP client started: {self._cmd[0]}")

    async def stop(self) -> None:
        if self._process:
            self._process.terminate()
            try:
                await asyncio.wait_for(self._process.wait(), timeout=5)
            except asyncio.TimeoutError:
                self._process.kill()
            self._process = None

    async def call_tool(self, tool_name: str, arguments: dict[str, Any] | None = None) -> dict[str, Any]:
        self._request_id += 1
        req_id = self._request_id
        request = {
            "jsonrpc": "2.0",
            "id": req_id,
            "method": "tools/call",
            "params": {"name": tool_name, "arguments": arguments or {}},
        }

        future = asyncio.get_event_loop().create_future()
        self._pending[req_id] = future

        if self._process and self._process.stdin:
            self._process.stdin.write((json.dumps(request) + "\n").encode())
            await self._process.stdin.drain()

        try:
            return await asyncio.wait_for(future, timeout=30)
        except asyncio.TimeoutError:
            self._pending.pop(req_id, None)
            return {"error": "MCP call timed out"}

    async def _read_loop(self) -> None:
        while self._process and self._process.stdout:
            line = await self._process.stdout.readline()
            if not line:
                break
            try:
                response = json.loads(line.decode().strip())
                req_id = response.get("id")
                if req_id and req_id in self._pending:
                    self._pending[req_id].set_result(response)
            except (json.JSONDecodeError, KeyError):
                pass
