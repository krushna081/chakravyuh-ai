import asyncio
import json
import logging
import os
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from core.types import (
    AgentConfig, AgentStatus, AgentMessage, MessagePriority,
    MemoryEntry, MemoryType, AgentCapability
)
from core.event_bus import get_event_bus
from core import llm
from core.session_store import get_session_store
from core.tool_executor import get_executor

logger = logging.getLogger("chakravyuh.agent")

PROMPTS_DIR = Path(__file__).resolve().parent.parent / "prompts"

_MAX_TOOL_ITERATIONS = 6
_TOOL_CALL_RE = re.compile(r'TOOL_CALL:\s*(\{.*?\})', re.DOTALL)


class BaseAgent:
    """A real worker agent.

    The turn loop is real end to end:
        prompt (prompts/<id>.md) → LLM (Ollama) → optional TOOL_CALL lines →
        tool execution (sandboxed/filesystem/web) → tool results fed back →
        final response, session lines persisted, episodic memory stored.

    When the LLM is unavailable the agent says so explicitly — no canned
    replies, no fake tool output.
    """

    def __init__(self, config: AgentConfig):
        self.config = config
        self.status = AgentStatus.IDLE
        self._task_queue: asyncio.Queue[AgentMessage] = asyncio.Queue()
        self._running = False
        self._worker_task: Optional[asyncio.Task] = None
        self._event_bus = get_event_bus()
        self._consecutive_calls = 0
        self._start_time: Optional[datetime] = None
        self._pending: dict[str, asyncio.Future] = {}
        self._session = get_session_store()

        self._event_bus.subscribe(f"agent.{config.id}.message", self._on_message)

    @property
    def id(self) -> str:
        return self.config.id

    @property
    def name(self) -> str:
        return self.config.name

    @property
    def role(self) -> str:
        return self.config.role

    @property
    def capabilities(self) -> list[AgentCapability]:
        return self.config.capabilities

    def system_prompt(self) -> str:
        prompt_file = PROMPTS_DIR / f"{self.id}.md"
        if prompt_file.exists():
            return prompt_file.read_text(encoding="utf-8")
        return self.config.system_prompt

    # ── lifecycle ─────────────────────────────────────────────────────

    async def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._start_time = datetime.now()
        self._worker_task = asyncio.create_task(self._worker_loop())
        self.status = AgentStatus.IDLE
        self._session.append(self.id, "— agent online —")
        await self._event_bus.publish("agent.started", {
            "agent_id": self.id, "agent_name": self.name
        })
        logger.info(f"Agent {self.name} ({self.id}) started")

    async def stop(self) -> None:
        self._running = False
        if self._worker_task:
            self._worker_task.cancel()
            try:
                await self._worker_task
            except asyncio.CancelledError:
                pass
        self.status = AgentStatus.IDLE
        self._session.append(self.id, "— agent offline —")
        await self._event_bus.publish("agent.stopped", {
            "agent_id": self.id, "agent_name": self.name
        })
        logger.info(f"Agent {self.name} ({self.id}) stopped")

    async def send_message(self, message: AgentMessage) -> None:
        await self._task_queue.put(message)

    async def send_and_wait(self, message: AgentMessage, timeout: float = 300.0) -> Optional[dict[str, Any]]:
        """Deliver a message and wait for the real reply (used by the orchestrator)."""
        fut: asyncio.Future = asyncio.get_running_loop().create_future()
        self._pending[message.id] = fut
        await self.send_message(message)
        try:
            return await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError:
            self._pending.pop(message.id, None)
            return {"status": "error", "error": f"Agent {self.id} timed out after {timeout}s"}

    # ── worker loop ───────────────────────────────────────────────────

    async def _worker_loop(self) -> None:
        while self._running:
            try:
                message = await asyncio.wait_for(self._task_queue.get(), timeout=1.0)
                self.status = AgentStatus.ACTIVE
                try:
                    await self._event_bus.publish("agent.task_started", {
                        "agent_id": self.id,
                        "message_id": message.id,
                        "type": message.type,
                    })
                    response = await self.handle_message(message)
                    if response:
                        await self._event_bus.publish(
                            f"agent.{message.from_agent}.message",
                            {"data": response},
                        )
                    fut = self._pending.pop(message.id, None)
                    if fut and not fut.done():
                        fut.set_result(response)
                    await self._event_bus.publish("agent.task_completed", {
                        "agent_id": self.id,
                        "message_id": message.id,
                    })
                except Exception as e:
                    logger.error(f"Agent {self.id} error: {e}")
                    self.status = AgentStatus.ERROR
                    await self._event_bus.publish("agent.error", {
                        "agent_id": self.id, "error": str(e)
                    })
                    await asyncio.sleep(2)
                    self.status = AgentStatus.IDLE
                finally:
                    self._task_queue.task_done()
                self._consecutive_calls = 0
            except asyncio.TimeoutError:
                if self._consecutive_calls > self.config.max_consecutive_calls:
                    self.status = AgentStatus.SLEEPING
                    await asyncio.sleep(5)
                    self.status = AgentStatus.IDLE
                    self._consecutive_calls = 0
                if self.status in (AgentStatus.ACTIVE, AgentStatus.PROCESSING):
                    self.status = AgentStatus.IDLE
            except asyncio.CancelledError:
                break

    async def handle_message(self, message: AgentMessage) -> Optional[dict[str, Any]]:
        task_text = (message.payload or {}).get("task") or (message.payload or {}).get("text", "")
        return await self.run_turn(task_text)

    # ── the real turn ─────────────────────────────────────────────────

    async def run_turn(self, task_text: str) -> dict[str, Any]:
        """Execute one real work turn: LLM ↔ tools ↔ final response."""
        if not task_text.strip():
            return {"status": "error", "error": "Empty task"}

        self.status = AgentStatus.PROCESSING
        self._session.append(self.id, f"▶ {self.name} received: {task_text[:300]}")

        o = llm.get_ollama()
        if o.detect() != "running":
            self.status = AgentStatus.ERROR
            msg = (
                f"LLM unavailable: Ollama is {o.detect()} "
                f"(expected a running server at {o.host}). Nothing executed."
            )
            self._session.append(self.id, f"✖ {msg}")
            await asyncio.sleep(2)
            self.status = AgentStatus.IDLE
            return {"status": "error", "error": msg}

        model = self.config.model
        if not o.has_model(model):
            self.status = AgentStatus.ERROR
            msg = (
                f"Model '{model}' is not installed. Pull it with `ollama pull {model}`. "
                f"Installed: {', '.join(o.model_names()) or 'none'}."
            )
            self._session.append(self.id, f"✖ {msg}")
            await asyncio.sleep(2)
            self.status = AgentStatus.IDLE
            return {"status": "error", "error": msg}

        tool_results: list[dict] = []
        steps: list[dict] = []
        final_text = ""

        try:
            for iteration in range(_MAX_TOOL_ITERATIONS):
                text = await llm.complete(
                    model,
                    self.system_prompt(),
                    task_text,
                    tool_results=tool_results,
                )
                if text is None:
                    raise RuntimeError(f"LLM call failed for model {model}")

                self._session.append(self.id, f"● {self.name} (iteration {iteration + 1}): {text[:500]}")
                tool_call = self._extract_tool_call(text)
                if not tool_call:
                    final_text = text
                    break

                tool_name = tool_call.get("tool", "")
                args = tool_call.get("args", {}) or {}
                if tool_name not in self.config.tools:
                    tool_results.append({
                        "content": f"TOOL RESULT: error — tool '{tool_name}' is not in this agent's allowed toolset ({', '.join(self.config.tools) or 'none'})."
                    })
                    self._session.append(self.id, f"✖ blocked tool '{tool_name}' (not allowed for {self.name})")
                    continue

                self._session.append(self.id, f"→ {self.name} calls {tool_name}({json.dumps(args)[:200]})")
                result = await get_executor().execute(tool_name, self.id, args)
                step = {
                    "agent": self.id,
                    "tool": tool_name,
                    "args": args,
                    "success": result.success,
                    "output": result.error if not result.success else json.dumps(result.data, default=str)[:2000],
                }
                steps.append(step)
                await self._event_bus.publish("agent.tool_used", {
                    "agent_id": self.id, "tool": tool_name, "success": result.success
                })
                if result.success:
                    self._session.append(self.id, f"← tool result: {json.dumps(result.data, default=str)[:300]}")
                    tool_results.append({
                        "content": f"TOOL RESULT: {json.dumps(result.data, default=str)[:8000]}"
                    })
                else:
                    self._session.append(self.id, f"← tool error: {result.error[:300]}")
                    tool_results.append({
                        "content": f"TOOL RESULT: error — {result.error}"
                    })

            if not final_text:
                final_text = "Reached the maximum tool-call iterations without a final answer."

            self._session.append(self.id, f"✓ {self.name} response: {final_text[:500]}")
            await self.store_memory(
                MemoryType.EPISODIC,
                f"[{self.name}] {task_text[:200]} → {final_text[:300]}",
                {"task": task_text[:200]},
            )
            self.status = AgentStatus.IDLE
            return {
                "status": "ok",
                "response": final_text,
                "steps": steps,
                "agent_id": self.id,
            }
        except Exception as e:
            logger.error(f"Agent {self.id} turn failed: {e}")
            self._session.append(self.id, f"✖ {self.name} error: {str(e)[:300]}")
            self.status = AgentStatus.IDLE
            return {"status": "error", "error": str(e), "steps": steps}

    def _extract_tool_call(self, text: str) -> Optional[dict[str, Any]]:
        m = _TOOL_CALL_RE.search(text)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                return None
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict) and "tool" in parsed:
                return parsed
        except json.JSONDecodeError:
            pass
        return None

    # ── messaging helpers ─────────────────────────────────────────────

    async def _on_message(self, event: dict) -> None:
        pass

    async def emit(self, event_type: str, data: dict[str, Any]) -> None:
        await self._event_bus.publish(event_type, data)

    def reply(self, original: AgentMessage, data: dict[str, Any]) -> AgentMessage:
        return AgentMessage(
            id=uuid.uuid4().hex[:12],
            from_agent=self.id,
            to_agent=original.from_agent,
            type="response",
            priority=original.priority,
            payload=data,
            metadata={"timestamp": datetime.now().isoformat(), "trace_id": original.metadata.get("trace_id", "")},
        )

    async def store_memory(self, memory_type: MemoryType, content: str, metadata: dict | None = None) -> None:
        entry = MemoryEntry(
            id=uuid.uuid4().hex[:12],
            agent_id=self.id,
            type=memory_type,
            content=content,
            metadata=metadata or {},
        )
        try:
            from memory.sqlite_backend import SQLiteBackend
            backend = SQLiteBackend()
            await backend.store(entry)
            await backend.close()
        except Exception as e:
            logger.warning(f"Memory persistence failed for {self.id}: {e}")
        await self._event_bus.publish("memory.store", {"entry": entry.__dict__})

    def get_uptime(self) -> str:
        if not self._start_time:
            return "0s"
        delta = datetime.now() - self._start_time
        hours, remainder = divmod(int(delta.total_seconds()), 3600)
        minutes, seconds = divmod(remainder, 60)
        if hours > 0:
            return f"{hours}h {minutes}m"
        if minutes > 0:
            return f"{minutes}m {seconds}s"
        return f"{seconds}s"