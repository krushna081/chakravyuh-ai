"""Chakravyuh AI CLI — the main entrypoint.

Usage:
    chakravyuh run          Start the full system
    chakravyuh start        Start Ollama + backend
    chakravyuh status       Show system status
    chakravyuh models       Manage Ollama models
    chakravyuh setup        One-command setup
"""

import os
import subprocess
import sys
from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

app = typer.Typer(
    name="chakravyuh",
    help="⚔ Multi-Agent AI Operating System — local-first, Ollama-powered",
    no_args_is_help=True,
    add_completion=True,
)
console = Console()

REPO_ROOT = Path(__file__).resolve().parent.parent


# ═══════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════

def _banner() -> None:
    """Print the startup banner."""
    banner = Text("""
    ╔══════════════════════════════════════════╗
    ║     ⚔  CHAKRAVYUH AI  —  v0.2.0        ║
    ║     Multi-Agent AI Operating System      ║
    ║     Local-first · Ollama-powered         ║
    ╚══════════════════════════════════════════╝
    """, style="bold cyan")
    console.print(banner)


def _check_python_deps() -> bool:
    """Check that required Python packages are installed."""
    try:
        import rich  # noqa: F401
        import typer  # noqa: F401
        return True
    except ImportError:
        return False


def _ensure_deps() -> None:
    """Auto-install Python dependencies if missing."""
    if not _check_python_deps():
        console.print("[yellow]Installing Python dependencies...[/]")
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "-r",
             str(REPO_ROOT / "requirements.txt")]
        )
        console.print("[green]✓[/] Dependencies installed")


# ═══════════════════════════════════════════════════════════════════════
# Commands
# ═══════════════════════════════════════════════════════════════════════

@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    """Chakravyuh AI CLI — Multi-Agent AI Operating System."""
    if ctx.invoked_subcommand is None:
        _banner()
        console.print("Run [bold]chakravyuh --help[/] for commands")
        console.print()
        console.print("Quick start:")
        console.print("  [bold]chakravyuh setup[/]     One-command setup")
        console.print("  [bold]chakravyuh run[/]       Start the full system")
        console.print("  [bold]chakravyuh status[/]    Show system status")
        console.print("  [bold]chakravyuh models[/]    Manage Ollama models")


@app.command()
def setup(
    auto_confirm: bool = typer.Option(
        False, "--yes", "-y", help="Auto-confirm all prompts"
    ),
):
    """One-command setup: install deps, configure Ollama, pull models."""
    _banner()
    console.print(Panel.fit(
        "[bold]🚀 One-Command Setup[/]\n"
        "This will:\n"
        "  1. Check Python dependencies\n"
        "  2. Detect / start Ollama\n"
        "  3. Pull recommended models (llama3.1, nomic-embed)\n"
        "  4. Create .env from template\n"
        "  5. Install Node.js dependencies (npm ci)\n"
        "  6. Build the web dashboard",
        border_style="cyan",
    ))

    if not _check_python_deps():
        _ensure_deps()

    from cli.ollama import OllamaManager, console as om_console
    om = OllamaManager()

    # Step 1: Ollama check
    console.print("\n[bold]Step 1: Checking Ollama...[/]")
    status = om.detect()
    if status == "not_installed":
        console.print("[red]✗[/] Ollama not found")
        console.print("  Install from: [link]https://ollama.com/download[/]")
        console.print("  Then re-run: [bold]chakravyuh setup[/]")
        raise typer.Exit(1)
    elif status == "stopped":
        console.print("[yellow]⚠[/] Starting Ollama...")
        om.start_server()
    else:
        console.print("[green]✓[/] Ollama running")

    # Step 2: Pull models
    console.print("\n[bold]Step 2: Pulling recommended models...[/]")
    om.pull_recommended()

    # Step 3: Create .env
    console.print("\n[bold]Step 3: Creating .env...[/]")
    env_path = REPO_ROOT / ".env"
    env_example = REPO_ROOT / ".env.example"
    if not env_path.exists() and env_example.exists():
        import shutil
        shutil.copy(env_example, env_path)
        console.print(f"[green]✓[/] Created {env_path}")
    elif env_path.exists():
        console.print(f"[dim]✓ .env already exists[/]")
    else:
        console.print("[yellow]⚠[/] No .env.example found, skipping")

    # Step 4: Install npm deps
    console.print("\n[bold]Step 4: Installing Node.js dependencies...[/]")
    try:
        subprocess.check_call(
            ["npm", "ci"],
            cwd=REPO_ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        console.print("[green]✓[/] npm ci complete")
    except subprocess.CalledProcessError:
        console.print("[yellow]⚠[/] npm ci had issues (may need Node.js)")
    except FileNotFoundError:
        console.print("[yellow]⚠[/] Node.js not found, skipping npm ci")

    # Step 5: Build
    console.print("\n[bold]Step 5: Building TypeScript...[/]")
    try:
        subprocess.check_call(
            ["npx", "tsc", "-p", "tsconfig.json"],
            cwd=REPO_ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        console.print("[green]✓[/] Build complete")
    except Exception:
        console.print("[yellow]⚠[/] Build warnings (pre-existing TS strict errors)")

    console.print("\n[bold green]✅ Setup complete![/]")
    console.print("Run [bold]chakravyuh run[/] to start the system")
    console.print("Or [bold]chakravyuh dashboard[/] to open web UI")


@app.command()
def run(
    host: str = typer.Option("127.0.0.1", "--host", "-H"),
    port: int = typer.Option(3001, "--port", "-p"),
    open_browser: bool = typer.Option(True, "--open/--no-open"),
    dev: bool = typer.Option(False, "--dev", "-d", help="Development mode with hot-reload"),
):
    """Start the full Chakravyuh system: Ollama + backend + dashboard."""
    _banner()
    console.print("[cyan]Starting Chakravyuh AI...[/]\n")

    # 1. Ensure Ollama is running
    from cli.ollama import OllamaManager
    om = OllamaManager()
    status = om.detect()
    if status == "not_installed":
        console.print("[red]✗[/] Ollama not installed. Run [bold]chakravyuh setup[/] first")
        raise typer.Exit(1)
    if status == "stopped":
        om.start_server()

    # 2. Ensure models are available
    if not om.has_model("llama3.1:8b"):
        console.print("[yellow]⚠ Default model (llama3.1:8b) not found[/]")
        om.pull_model("llama3.1:8b")

    # 3. Start the backend server
    console.print(f"[cyan]Starting API server on {host}:{port}...[/]")
    env = os.environ.copy()
    env["CHAKRAVYUH_HOST"] = host
    env["CHAKRAVYUH_PORT"] = str(port)

    server_cmd = [
        sys.executable, "-m", "uvicorn",
        "backend.python.api:app",
        "--host", host,
        "--port", str(port),
        "--log-level", "info",
    ]
    if dev:
        server_cmd.append("--reload")

    server_proc = subprocess.Popen(
        server_cmd,
        cwd=REPO_ROOT,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
    )

    import time
    time.sleep(2)

    if open_browser:
        import webbrowser
        webbrowser.open(f"http://{host}:{port}")
        console.print(f"[green]✓[/] Dashboard opened at [link]http://{host}:{port}[/]")

    console.print("\n[dim]Press Ctrl+C to stop[/dim]")
    try:
        server_proc.wait()
    except KeyboardInterrupt:
        console.print("\n[yellow]Shutting down...[/]")
        server_proc.terminate()
        server_proc.wait()
        console.print("[green]✓[/] Stopped")


@app.command()
def status():
    """Show system status: Ollama, models, backend."""
    _banner()

    # Ollama status
    from cli.ollama import OllamaManager
    om = OllamaManager()
    om.show_status()

    # Models table
    models = om.list_models()
    if models:
        table = Table(title="Installed Models", box=None)
        table.add_column("Name", style="cyan")
        table.add_column("Size")
        table.add_column("Modified")
        for m in sorted(models, key=lambda x: x.get("name", "")):
            size = m.get("size", 0)
            size_str = f"{size / 1e9:.1f}GB" if size else "?"
            modified = m.get("modified_at", "")[:10] if m.get("modified_at") else "?"
            table.add_row(m.get("name", "?"), size_str, modified)
        console.print(table)

    # Backend check
    import httpx
    try:
        r = httpx.get("http://127.0.0.1:3001/health", timeout=3)
        if r.status_code == 200:
            console.print("\n[green]✓[/] Backend API: [bold]running[/]")
        else:
            console.print("\n[yellow]⚠[/] Backend API: unexpected response")
    except httpx.ConnectError:
        console.print("\n[red]✗[/] Backend API: [bold]not running[/]")
        console.print("  Start with: [bold]chakravyuh run[/]")


@app.command()
def models(
    pull: str = typer.Option(None, "--pull", "-p", help="Pull a specific model"),
    list_all: bool = typer.Option(False, "--list", "-l", help="List installed models"),
    recommended: bool = typer.Option(False, "--recommended", "-r", help="Pull recommended models"),
    remove: str = typer.Option(None, "--remove", help="Remove a model"),
):
    """Manage Ollama models."""
    from cli.ollama import OllamaManager, RECOMMENDED_MODELS

    om = OllamaManager()
    status = om.detect()

    if status == "not_installed":
        console.print("[red]✗[/] Ollama not installed")
        raise typer.Exit(1)
    if status == "stopped":
        console.print("[yellow]⚠[/] Ollama not running. Start with: [bold]ollama serve[/]")
        raise typer.Exit(1)

    if pull:
        om.pull_model(pull)
        return

    if recommended:
        console.print("[cyan]Pulling recommended models...[/]")
        for name, info in RECOMMENDED_MODELS.items():
            desc = info["description"]
            console.print(f"  [dim]{desc}[/]")
        om.pull_recommended(list(RECOMMENDED_MODELS.keys()))
        return

    if remove:
        import subprocess
        subprocess.run(["ollama", "rm", remove])
        console.print(f"[green]✓[/] Removed {remove}")
        return

    if list_all or True:
        models = om.list_models()
        if not models:
            console.print("[yellow]No models installed[/]")
            console.print("  Pull a model: [bold]chakravyuh models --pull llama3.1:8b[/]")
            console.print("  Or: [bold]chakravyuh models --recommended[/]")
            return

        table = Table(title="Installed Models", box=None)
        table.add_column("Name", style="cyan")
        table.add_column("Size")
        table.add_column("Modified")
        for m in sorted(models, key=lambda x: x.get("name", "")):
            size = m.get("size", 0)
            size_str = f"{size / 1e9:.1f}GB" if size else "?"
            modified = m.get("modified_at", "")[:10] if m.get("modified_at") else "?"
            table.add_row(m.get("name", "?"), size_str, modified)
        console.print(table)

        console.print("\n[dim]Recommended models:[/]")
        for name, info in RECOMMENDED_MODELS.items():
            console.print(f"  [cyan]{name}[/] — {info['description']}")


@app.command()
def dashboard(
    host: str = typer.Option("127.0.0.1", "--host"),
    port: int = typer.Option(3001, "--port"),
):
    """Open the web dashboard in your browser."""
    import webbrowser
    url = f"http://{host}:{port}"
    console.print(f"[cyan]Opening {url}...[/]")
    webbrowser.open(url)
    console.print(f"[green]✓[/] Dashboard opened")


@app.command()
def chat(
    model: str = typer.Option(
        "llama3.1:8b", "--model", "-m",
        help="Ollama model to use",
    ),
    system_prompt: str = typer.Option(
        "You are a helpful AI assistant in the Chakravyuh multi-agent system.",
        "--system", "-s",
        help="System prompt for the agent",
    ),
):
    """Start an interactive chat session with an Ollama model."""
    from cli.ollama import OllamaManager

    om = OllamaManager()
    status = om.detect()
    if status != "running":
        console.print("[red]✗[/] Ollama is not running")
        raise typer.Exit(1)

    if not om.has_model(model):
        console.print(f"[yellow]⚠ Model {model} not found, pulling...[/]")
        om.pull_model(model)
        console.print()

    messages = [{"role": "system", "content": system_prompt}]
    console.print(f"[bold cyan]💬 Chat with {model}[/]")
    console.print("[dim]Type /exit to quit, /clear to clear history[/]\n")

    while True:
        try:
            user_input = console.input("[bold green]You > [/]")
        except (EOFError, KeyboardInterrupt):
            break

        if not user_input.strip():
            continue
        if user_input.strip() == "/exit":
            break
        if user_input.strip() == "/clear":
            messages = messages[:1]
            console.print("[dim]History cleared[/]")
            continue

        messages.append({"role": "user", "content": user_input})
        console.print("[bold blue]AI > [/]", end="")

        full_response = ""
        for chunk in om.chat(model, messages, stream=True):
            if chunk.get("done"):
                break
            content = chunk.get("message", {}).get("content", "")
            full_response += content
            console.print(content, end="")
        console.print()
        messages.append({"role": "assistant", "content": full_response})


@app.command()
def version():
    """Show version information."""
    _banner()
    console.print(f"Version:   0.2.0-alpha")
    console.print(f"License:   Apache 2.0")
    console.print(f"Python:    {sys.version.split()[0]}")
    console.print(f"Platform:  {sys.platform}")
    console.print(f"Repository: [link]https://github.com/krushna081/chakravyuh-ai[/]")


if __name__ == "__main__":
    app()
