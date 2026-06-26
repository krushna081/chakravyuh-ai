"""Ollama integration — auto-detect, pull, and manage local models."""

import json
import shutil
import subprocess
import sys
from pathlib import Path

import httpx
from rich.console import Console
from rich.progress import (
    BarColumn,
    DownloadColumn,
    Progress,
    TextColumn,
    TimeRemainingColumn,
    TransferSpeedColumn,
)

console = Console()

OLLAMA_DEFAULT_HOST = "http://127.0.0.1:11434"
RECOMMENDED_MODELS = {
    "llama3.1:8b": {
        "description": "Meta Llama 3.1 8B — best general-purpose (default)",
        "ram": "8GB",
        "capabilities": "chat, reasoning, tool use, code",
    },
    "phi3:14b": {
        "description": "Phi-3 14B — strong reasoning, small footprint",
        "ram": "12GB",
        "capabilities": "chat, reasoning, math, code",
    },
    "mistral:7b": {
        "description": "Mistral 7B — fast, efficient, good tool use",
        "ram": "6GB",
        "capabilities": "chat, tool use, code, multilingual",
    },
    "qwen2.5:7b": {
        "description": "Qwen 2.5 7B — strong coding and instruction following",
        "ram": "8GB",
        "capabilities": "chat, code, reasoning, multilingual",
    },
    "gemma2:9b": {
        "description": "Gemma 2 9B — Google's efficient general model",
        "ram": "8GB",
        "capabilities": "chat, reasoning, instruction following",
    },
    "nomic-embed-text:v1.5": {
        "description": "Embeddings model for memory/RAG (always recommended)",
        "ram": "2GB",
        "capabilities": "text embeddings, semantic search",
    },
}


class OllamaManager:
    """Manages Ollama server detection, model pulling, and API calls."""

    def __init__(self, host: str | None = None):
        self.host = (host or OLLAMA_DEFAULT_HOST).rstrip("/")
        self.client = httpx.Client(base_url=self.host, timeout=5)

    # ── Detection ──────────────────────────────────────────────────────

    def is_installed(self) -> bool:
        """Check if the `ollama` CLI binary is on PATH."""
        return shutil.which("ollama") is not None

    def is_running(self) -> bool:
        """Check if the Ollama server is reachable."""
        try:
            r = self.client.get("/api/tags", timeout=3)
            return r.status_code == 200
        except (httpx.ConnectError, httpx.TimeoutException):
            return False

    def detect(self) -> str:
        """Return a human-readable status string."""
        if not self.is_installed():
            return "not_installed"
        if not self.is_running():
            return "stopped"
        return "running"

    # ── Model Management ───────────────────────────────────────────────

    def list_models(self) -> list[dict]:
        """Return list of installed models with metadata."""
        try:
            r = self.client.get("/api/tags", timeout=10)
            r.raise_for_status()
            data = r.json()
            return data.get("models", [])
        except Exception:
            return []

    def model_names(self) -> list[str]:
        return [m["name"] for m in self.list_models()]

    def has_model(self, name: str) -> bool:
        return name in self.model_names()

    def pull_model(self, name: str) -> bool:
        """Pull a model, showing a progress bar. Returns True on success."""
        console.print(f"\n[bold cyan]⬇  Pulling {name}...[/]")
        try:
            process = subprocess.Popen(
                ["ollama", "pull", name],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
            )
            with Progress(
                TextColumn("[progress.description]{task.description}"),
                BarColumn(),
                DownloadColumn(),
                TransferSpeedColumn(),
                TimeRemainingColumn(),
                console=console,
            ) as progress:
                task = progress.add_task(f"[cyan]Downloading {name}", total=None)
                for line in process.stdout or []:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        data = json.loads(line)
                        if "completed" in data and "total" in data:
                            progress.update(
                                task,
                                total=data["total"],
                                completed=data["completed"],
                            )
                        elif "status" in data:
                            progress.update(
                                task,
                                description=f"[cyan]{data['status']}",
                            )
                    except json.JSONDecodeError:
                        progress.update(
                            task, description=f"[cyan]{line[:60]}"
                        )
            process.wait()
            if process.returncode == 0:
                console.print(f"[green]✓[/] {name} installed")
                return True
            console.print(f"[red]✗[/] Failed to pull {name}")
            return False
        except FileNotFoundError:
            console.print("[red]✗[/] `ollama` CLI not found")
            return False

    def pull_recommended(self, models: list[str] | None = None) -> None:
        """Pull a selection of recommended models."""
        if models is None:
            models = ["llama3.1:8b", "nomic-embed-text:v1.5"]
        for model in models:
            if not self.has_model(model):
                self.pull_model(model)
            else:
                console.print(f"[dim]✓ {model} already installed[/]")

    # ── Inference ─────────────────────────────────────────────────────

    def chat(
        self,
        model: str,
        messages: list[dict],
        stream: bool = True,
    ):
        """Chat completion via Ollama API."""
        url = f"{self.host}/api/chat"
        payload = {"model": model, "messages": messages, "stream": stream}
        with self.client.stream("POST", url, json=payload, timeout=120) as r:
            if stream:
                for line in r.iter_lines():
                    if line:
                        yield json.loads(line)
            else:
                yield r.json()

    def generate_embedding(self, model: str, text: str) -> list[float]:
        """Generate embeddings using Ollama."""
        url = f"{self.host}/api/embed"
        payload = {"model": model, "input": text}
        r = self.client.post(url, json=payload, timeout=30)
        r.raise_for_status()
        return r.json().get("embeddings", [])[0]

    # ── Server Management ──────────────────────────────────────────────

    def start_server(self) -> subprocess.Popen | None:
        """Start Ollama server in background. Returns process or None."""
        if self.is_running():
            console.print("[yellow]Ollama already running[/]")
            return None
        console.print("[cyan]Starting Ollama server...[/]")
        try:
            proc = subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            console.print("[green]✓[/] Ollama server started")
            return proc
        except FileNotFoundError:
            console.print("[red]✗[/] `ollama` CLI not found")
            return None

    def show_status(self) -> None:
        """Pretty-print Ollama status."""
        status = self.detect()
        if status == "not_installed":
            console.print("[red]✗[/] Ollama is [bold]not installed[/]")
            console.print(
                "  Install from: [link]https://ollama.com/download[/]"
            )
        elif status == "stopped":
            console.print("[yellow]⚠[/] Ollama installed but [bold]not running[/]")
            console.print("  Run: [bold]ollama serve[/] or [bold]chakravyuh start[/]")
        else:
            console.print("[green]✓[/] Ollama is [bold]running[/]")
            models = self.list_models()
            if models:
                console.print(f"  Models installed: {len(models)}")
                for m in models:
                    size = m.get("size", 0)
                    size_str = (
                        f"{size / 1e9:.1f}GB" if size else "unknown"
                    )
                    console.print(f"    · {m['name']} ({size_str})")
            else:
                console.print("  [dim]No models installed[/]")
