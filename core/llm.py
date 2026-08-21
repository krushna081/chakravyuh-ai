"""Real LLM access via Ollama, with honest availability reporting.

`OllamaManager` from cli.ollama handles detection. This module wraps it for
agent use: system prompt + message list in, text out. Every call surfaces a
truthful reason when Ollama is missing, stopped, or missing a model — agents
never pretend to have an LLM they don't.
"""
import asyncio
import logging
from typing import Any, Optional

from cli.ollama import OllamaManager

logger = logging.getLogger("chakravyuh.llm")

_ollama: Optional[OllamaManager] = None


def get_ollama() -> OllamaManager:
    global _ollama
    if _ollama is None:
        _ollama = OllamaManager()
    return _ollama


def status() -> dict[str, Any]:
    """Human-readable integration status for the readiness UI."""
    o = get_ollama()
    detect = o.detect()
    state = {
        "name": "Ollama (local LLM)",
        "purpose": "Runs the agent brain — system prompts, tool-call parsing, replies",
        "required": True,
        "free": True,
        "status": "disconnected",
        "reason": "",
        "config_var": "OLLAMA_HOST",
        "alternative": "Install Ollama (ollama.com) and pull a model, e.g. `ollama pull llama3.1:8b`",
    }
    if detect == "running":
        models = o.model_names()
        state["status"] = "connected"
        state["reason"] = f"Reachable at {o.host} with {len(models)} installed models"
        state["models"] = models
    elif detect == "not_installed":
        state["reason"] = "`ollama` binary not found on PATH"
    elif detect == "stopped":
        state["reason"] = f"Server at {o.host} is not responding — start it with `ollama serve`"
    elif detect == "cloud":
        state["reason"] = "Ollama Cloud configured — not enabled by default"
    elif detect == "cloud_unreachable":
        state["reason"] = "Ollama Cloud configured but unreachable — check CHAKRAVYUH_OLLAMA_CLOUD / OLLAMA_API_KEY"
    return state


def available() -> bool:
    return get_ollama().detect() == "running"


def available_models() -> list[str]:
    return get_ollama().model_names()


def has_model(model: str) -> bool:
    return get_ollama().has_model(model)


async def complete(
    model: str,
    system_prompt: str,
    user_text: str,
    tool_results: Optional[list[dict]] = None,
) -> Optional[str]:
    """Run one chat completion. Returns the assistant text or None on failure.

    tool_results are appended as follow-up user messages (tool-call loop
    carried out by the agent).
    """
    o = get_ollama()
    detect = o.detect()
    if detect != "running":
        return None
    if not o.has_model(model):
        return None

    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    messages.append({"role": "user", "content": user_text})
    if tool_results:
        for tr in tool_results:
            messages.append({"role": "user", "content": tr["content"]})

    try:
        response = await asyncio.to_thread(
            lambda: list(o.chat(model, messages, stream=False))
        )
        if not response:
            return None
        return response[-1].get("message", {}).get("content", "").strip()
    except Exception as e:
        logger.error(f"LLM completion failed for {model}: {e}")
        return None