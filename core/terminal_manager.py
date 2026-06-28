import asyncio
import logging
import os
import platform
import shlex
import tempfile
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

logger = logging.getLogger("chakravyuh.terminal")


@dataclass
class AgentTerminal:
    id: str
    name: str
    role: str
    sandbox_dir: Path
    process: Optional[asyncio.subprocess.Process] = None
    stdin: Optional[asyncio.StreamWriter] = None
    stdout: Optional[asyncio.StreamReader] = None
    stderr: Optional[asyncio.StreamReader] = None
    buffer: list[str] = field(default_factory=list)
    max_buffer: int = 500
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    last_active: str = field(default_factory=lambda: datetime.now().isoformat())
    is_running: bool = False
    env: dict[str, str] = field(default_factory=dict)
    file_permissions: list[str] = field(default_factory=lambda: ["sandbox"])
    granted_paths: list[str] = field(default_factory=list)


class TerminalManager:
    def __init__(self, base_dir: str | None = None):
        self._base_dir = Path(base_dir or "data/terminals").resolve()
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._terminals: dict[str, AgentTerminal] = {}
        self._lock = asyncio.Lock()
        self._shell = self._detect_shell()

    def _detect_shell(self) -> str:
        if platform.system() == "Windows":
            return "pwsh.exe" if self._which("pwsh.exe") else "powershell.exe"
        return os.environ.get("SHELL", "/bin/bash")

    def _which(self, program: str) -> bool:
        import shutil
        return shutil.which(program) is not None

    async def create_terminal(
        self,
        agent_id: str,
        agent_name: str,
        agent_role: str,
    ) -> AgentTerminal:
        sandbox = self._base_dir / agent_id
        sandbox.mkdir(parents=True, exist_ok=True)

        term = AgentTerminal(
            id=agent_id,
            name=agent_name,
            role=agent_role,
            sandbox_dir=sandbox,
            env={
                "CHAKRAVYUH_AGENT_ID": agent_id,
                "CHAKRAVYUH_AGENT_NAME": agent_name,
                "CHAKRAVYUH_SANDBOX": str(sandbox),
                "PS1": f"({agent_name}) $ ",
            },
        )
        self._terminals[agent_id] = term
        logger.info(f"Terminal created for {agent_name} ({agent_id}) at {sandbox}")
        return term

    async def spawn(self, agent_id: str) -> bool:
        term = self._terminals.get(agent_id)
        if not term:
            logger.error(f"No terminal for agent {agent_id}")
            return False
        if term.is_running:
            logger.warning(f"Terminal {agent_id} already running")
            return True

        full_env = {**os.environ, **term.env}
        shell_cmd = self._shell

        try:
            proc = await asyncio.create_subprocess_shell(
                shell_cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=str(term.sandbox_dir),
                env=full_env,
            )

            term.process = proc
            term.stdin = proc.stdin
            term.stdout = proc.stdout
            term.stderr = proc.stderr
            term.is_running = True

            asyncio.create_task(self._read_stdout(agent_id))
            asyncio.create_task(self._read_stderr(agent_id))

            logger.info(f"Terminal spawned for {term.name} (PID {proc.pid})")
            return True

        except Exception as e:
            logger.error(f"Failed to spawn terminal for {agent_id}: {e}")
            term.is_running = False
            return False

    async def _read_stdout(self, agent_id: str) -> None:
        term = self._terminals.get(agent_id)
        if not term or not term.stdout:
            return
        try:
            while term.is_running and not term.stdout.at_eof():
                line = await term.stdout.readline()
                if line:
                    decoded = line.decode(errors="replace").rstrip("\r\n")
                    if decoded:
                        term.buffer.append(decoded)
                        if len(term.buffer) > term.max_buffer:
                            term.buffer.pop(0)
                        term.last_active = datetime.now().isoformat()
        except (asyncio.CancelledError, ValueError):
            pass
        except Exception as e:
            logger.error(f"stdout read error for {agent_id}: {e}")

    async def _read_stderr(self, agent_id: str) -> None:
        term = self._terminals.get(agent_id)
        if not term or not term.stderr:
            return
        try:
            while term.is_running and not term.stderr.at_eof():
                line = await term.stderr.readline()
                if line:
                    decoded = line.decode(errors="replace").rstrip("\r\n")
                    if decoded:
                        term.buffer.append(f"[stderr] {decoded}")
                        if len(term.buffer) > term.max_buffer:
                            term.buffer.pop(0)
                        term.last_active = datetime.now().isoformat()
        except (asyncio.CancelledError, ValueError):
            pass
        except Exception as e:
            logger.error(f"stderr read error for {agent_id}: {e}")

    async def send_command(self, agent_id: str, command: str) -> bool:
        term = self._terminals.get(agent_id)
        if not term or not term.is_running or not term.stdin:
            logger.warning(f"Cannot send to {agent_id}: terminal not running")
            return False

        try:
            term.stdin.write((command + "\n").encode())
            await term.stdin.drain()
            term.last_active = datetime.now().isoformat()
            term.buffer.append(f"> {command}")
            if len(term.buffer) > term.max_buffer:
                term.buffer.pop(0)
            return True
        except Exception as e:
            logger.error(f"Failed to send command to {agent_id}: {e}")
            return False

    async def send_prompt(self, agent_id: str, prompt: str) -> bool:
        return await self.send_command(agent_id, prompt)

    async def kill(self, agent_id: str) -> bool:
        term = self._terminals.get(agent_id)
        if not term or not term.process:
            return False
        try:
            term.process.terminate()
            try:
                await asyncio.wait_for(term.process.wait(), timeout=5)
            except asyncio.TimeoutError:
                term.process.kill()
            term.is_running = False
            logger.info(f"Terminal killed for {term.name}")
            return True
        except Exception as e:
            logger.error(f"Failed to kill terminal {agent_id}: {e}")
            return False

    async def kill_all(self) -> None:
        for agent_id in list(self._terminals.keys()):
            await self.kill(agent_id)

    def get_terminal(self, agent_id: str) -> Optional[AgentTerminal]:
        return self._terminals.get(agent_id)

    def get_all_terminals(self) -> dict[str, AgentTerminal]:
        return dict(self._terminals)

    def get_buffer(self, agent_id: str, lines: int = 50) -> list[str]:
        term = self._terminals.get(agent_id)
        if not term:
            return []
        return term.buffer[-lines:]

    def get_status(self, agent_id: str) -> str:
        term = self._terminals.get(agent_id)
        if not term:
            return "unknown"
        if not term.is_running:
            return "stopped"
        return "running"

    def get_all_statuses(self) -> dict[str, str]:
        return {aid: self.get_status(aid) for aid in self._terminals}

    async def grant_file_access(self, agent_id: str, path: str) -> bool:
        term = self._terminals.get(agent_id)
        if not term:
            return False
        resolved = str(Path(path).resolve())
        if resolved not in term.granted_paths:
            term.granted_paths.append(resolved)
            term.file_permissions.append(f"grant:{resolved}")
        return True

    async def revoke_file_access(self, agent_id: str, path: str) -> bool:
        term = self._terminals.get(agent_id)
        if not term:
            return False
        resolved = str(Path(path).resolve())
        term.granted_paths = [p for p in term.granted_paths if p != resolved]
        term.file_permissions = [p for p in term.file_permissions if f"grant:{resolved}" not in p]
        return True

    async def spawn_all_agents(self, agent_configs: dict[str, tuple[str, str]]) -> None:
        for agent_id, (name, role) in agent_configs.items():
            await self.create_terminal(agent_id, name, role)
            await self.spawn(agent_id)
