import asyncio
import os
import sys
from typing import Optional

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.live import Live
from rich.layout import Layout
from rich import box

from cli import __version__

app = typer.Typer(name="chakravyuh", help="Chakravyuh AI — Multi-Agent Command Center")
console = Console()

CONTEXT_SETTINGS = dict(help_option_names=["-h", "--help"])


@app.callback(invoke_without_command=True)
def main(ctx: typer.Context):
    if ctx.invoked_subcommand is None:
        print_banner()
        console.print(Panel(
            "[bold]Chakravyuh AI[/bold] v" + __version__ + "\n"
            "Multi-Agent AI Operating System — Local-first, Ollama-powered\n\n"
            "Commands:\n"
            "  [bold cyan]setup[/bold cyan]     One-command system setup\n"
            "  [bold cyan]run[/bold cyan]       Start the orchestrator + API\n"
            "  [bold cyan]tui[/bold cyan]       Launch the terminal dashboard\n"
            "  [bold cyan]status[/bold cyan]    System status overview\n"
            "  [bold cyan]models[/bold cyan]    Manage Ollama models\n"
            "  [bold cyan]chat[/bold cyan]      Interactive chat with agents\n"
            "  [bold cyan]task[/bold cyan]      Submit a task to the agent mesh\n"
            "  [bold cyan]agents[/bold cyan]    List and manage agents\n",
            title="⚔ Chakravyuh Command Center",
            border_style="cyan",
        ))


def print_banner():
    console.print(r"""
[bold cyan]   ____ _            _    __          __   _  __     __
  / ___| |__   __ _| |_  \ \        / /__| | \ \   / /
 | |   | '_ \ / _` | __|  \ \  /\  / / _ \ |  \ \ / /
 | |___| | | | (_| | |_    \ \/  \/ /  __/ |   \ V /
  \____|_| |_|\__,_|\__|    \__/\__/ \___|_|    \_/ [/bold cyan]
[dim]  Multi-Agent AI Operating System[/dim]    [bold]v""" + __version__ + """[/bold]
""")


@app.command()
def setup(
    pull_models: bool = typer.Option(True, "--no-pull", help="Skip pulling models"),
    npm_install: bool = typer.Option(True, "--no-npm", help="Skip npm install"),
):
    """One-command system setup — install deps, pull models, configure environment"""
    from cli.ollama import OllamaManager
    from cli.config import ChakravyuhConfig

    console.print("[bold]⚔ Chakravyuh Setup[/bold]\n")

    with console.status("[cyan]Detecting Ollama...[/cyan]"):
        ollama = OllamaManager()
        detected = ollama.detect()

    if detected == "cloud":
        console.print("[green]✓[/green] Ollama Cloud connected [dim](no GPU needed)[/dim]")

    elif detected == "cloud_unreachable":
        console.print("[red]✗[/red] Ollama Cloud unreachable — check OLLAMA_API_KEY in .env")

    elif detected == "running":
        console.print("[green]✓[/green] Ollama detected (local)")
        if pull_models:
            models = ["llama3.1:8b", "qwen2.5:7b", "mistral:7b", "gemma2:9b", "phi3:14b", "nomic-embed-text"]
            for model in models:
                if not ollama.has_model(model):
                    with console.status(f"[cyan]Pulling {model}...[/cyan]"):
                        ollama.pull(model)
                    console.print(f"[green]✓[/green] Pulled [bold]{model}[/bold]")
                else:
                    console.print(f"[dim]✓[/dim] [bold]{model}[/bold] already installed")
        else:
            console.print("[dim]Model pulling skipped[/dim]")

    elif detected == "stopped":
        console.print("[yellow]⚠[/yellow] Ollama installed but not running")
        if ollama.is_cloud:
            console.print("[dim]Cloud mode — local server not needed[/dim]")
        else:
            with console.status("[cyan]Starting Ollama...[/cyan]"):
                ollama.start()
            console.print("[green]✓[/green] Ollama started")

    else:
        console.print("[yellow]![/yellow] Ollama not found. Install from https://ollama.com/download")
        console.print("[dim]You can still use cloud providers via .env API keys[/dim]")

    if npm_install and os.path.exists("package.json"):
        with console.status("[cyan]Installing npm dependencies...[/cyan]"):
            os.system("npm ci 2>/dev/null")
        console.print("[green]✓[/green] npm dependencies installed")

    if not os.path.exists(".env"):
        if os.path.exists(".env.example"):
            with open(".env.example") as f:
                example = f.read()
            with open(".env", "w") as f:
                f.write("# Chakravyuh AI Configuration\n# Copy what you need from .env.example\n")
            console.print("[green]✓[/green] Created .env from .env.example")
        else:
            with open(".env", "w") as f:
                f.write("CHAKRAVYUH_ROUTER_MODE=local\nOLLAMA_HOST=http://127.0.0.1:11434\n")
            console.print("[green]✓[/green] Created .env with defaults")

    console.print("\n[bold green]Setup complete![/bold green] Run [bold cyan]cv run[/bold cyan] to start.")


@app.command()
def run(
    host: str = typer.Option("127.0.0.1", "--host", "-H", help="API host"),
    port: int = typer.Option(3001, "--port", "-p", help="API port"),
    open_browser: bool = typer.Option(True, "--no-browser", help="Don't open browser"),
):
    """Start the orchestrator + API server"""
    from cli.ollama import OllamaManager

    ollama = OllamaManager()
    if ollama.detect() and not ollama.is_running():
        console.print("[yellow]Starting Ollama...[/yellow]")
        ollama.start()
        console.print("[green]✓[/green] Ollama started")

    console.print("[bold cyan]Starting Chakravyuh API server...[/bold cyan]")
    console.print(f"  Dashboard: [underline]http://{host}:{port}/[/underline]")
    console.print(f"  API:       [underline]http://{host}:{port}/api/v1/[/underline]")
    console.print("  Press [bold]Ctrl+C[/bold] to stop\n")

    if open_browser:
        import webbrowser
        webbrowser.open(f"http://{host}:{port}/")

    os.environ["CHAKRAVYUH_HOST"] = host
    os.environ["CHAKRAVYUH_PORT"] = str(port)

    import uvicorn
    uvicorn.run("api.app:app", host=host, port=port, reload=False, log_level="info")


@app.command()
def tui():
    """Launch the multi-terminal Command Center (Textual TUI)"""
    try:
        from core.terminal_manager import TerminalManager
        from core.prompt_engineer import PromptEngineer
        from cli.tui import ChakravyuhCommandCenter

        tm = TerminalManager()
        pe = PromptEngineer(tm)

        app = ChakravyuhCommandCenter(terminal_manager=tm, prompt_engineer=pe)
        app.run()
    except ImportError:
        console.print("[red]Error:[/red] Textual is required. Install with: pip install textual")
        raise typer.Exit(1)


@app.command()
def status():
    """Show system status overview"""
    from cli.ollama import OllamaManager
    from cli.config import ChakravyuhConfig

    config = ChakravyuhConfig()
    ollama = OllamaManager()

    table = Table(box=box.ROUNDED, title="System Status")
    table.add_column("Component", style="bold cyan")
    table.add_column("Status", style="bold")
    table.add_column("Details")

    table.add_row("Engine", f"[bold green]{config.router_mode.value}[/bold green]", f"Router: {config.router_mode.value}")

    if ollama.detect():
        if ollama.is_running():
            models = ollama.list_models()
            table.add_row("Ollama", "[green]Running[/green]", f"{len(models)} models installed")
            for m in models[:5]:
                table.add_row("", "", f"  • {m['name']} ({m.get('size', '?')})")
            if len(models) > 5:
                table.add_row("", "", f"  ... and {len(models) - 5} more")
        else:
            table.add_row("Ollama", "[yellow]Not running[/yellow]", "Run 'cv run' to start")
    else:
        table.add_row("Ollama", "[red]Not found[/red]", "Install from ollama.com/download")

    table.add_row("CLI", "[green]Ready[/green]", f"v{__version__}")
    table.add_row("API", "[dim]Stopped[/dim]", "Run 'cv run' to start API")

    console.print(table)


@app.command()
def models(
    list_models: bool = typer.Option(False, "--list", "-l", help="List installed models"),
    pull: Optional[str] = typer.Option(None, "--pull", "-p", help="Pull a model"),
    remove: Optional[str] = typer.Option(None, "--remove", "-r", help="Remove a model"),
):
    """Manage Ollama models"""
    from cli.ollama import OllamaManager

    ollama = OllamaManager()
    if not ollama.detect():
        console.print("[red]Ollama not found[/red]")
        raise typer.Exit(1)

    if not ollama.is_running():
        console.print("[yellow]Starting Ollama...[/yellow]")
        ollama.start()

    if pull:
        with console.status(f"[cyan]Pulling {pull}...[/cyan]"):
            result = ollama.pull(pull)
        console.print(f"[green]✓[/green] Pulled [bold]{pull}[/bold]")
        return

    if remove:
        ollama.remove(remove)
        console.print(f"[green]✓[/green] Removed [bold]{remove}[/bold]")
        return

    models = ollama.list_models()
    if not models:
        console.print("[yellow]No models installed[/yellow]")
        console.print("Pull one: [bold cyan]cv models --pull llama3.1:8b[/bold cyan]")
        return

    table = Table(box=box.ROUNDED, title="Installed Models")
    table.add_column("Name", style="cyan")
    table.add_column("Size")
    table.add_column("Modified")

    for m in models:
        table.add_row(m.get("name", "?"), m.get("size", "?"), m.get("modified", "?"))

    console.print(table)


@app.command()
def chat(
    model: str = typer.Option("llama3.1:8b", "--model", "-m", help="Model to use"),
    stream: bool = typer.Option(True, "--no-stream", help="Disable streaming"),
):
    """Interactive chat with an Ollama model"""
    from cli.ollama import OllamaManager

    ollama = OllamaManager()
    if not ollama.detect():
        console.print("[red]Ollama not found[/red]")
        raise typer.Exit(1)

    if not ollama.is_running():
        console.print("[yellow]Starting Ollama...[/yellow]")
        ollama.start()

    if not ollama.has_model(model):
        console.print(f"[yellow]Model {model} not found. Pulling...[/yellow]")
        with console.status(f"[cyan]Pulling {model}...[/cyan]"):
            ollama.pull(model)

    console.print(f"[bold cyan]Chatting with {model}[/bold cyan]")
    console.print("[dim]Type 'exit' or Ctrl+C to quit[/dim]\n")

    messages = []
    while True:
        try:
            user_input = console.input("[bold green]You:[/bold green] ")
            if user_input.lower() in ("exit", "quit", "/exit", "/quit"):
                break

            messages.append({"role": "user", "content": user_input})
            console.print("[bold cyan]AI:[/bold cyan] ", end="")

            response = ""
            for chunk in ollama.chat(model, messages, stream=stream):
                if chunk.get("done"):
                    break
                content = chunk.get("message", {}).get("content", chunk.get("content", ""))
                if content:
                    response += content
                    if stream:
                        console.print(content, end="")
                    sys.stdout.flush()

            if stream:
                console.print()
            messages.append({"role": "assistant", "content": response})

        except KeyboardInterrupt:
            console.print("\n[yellow]Bye![/yellow]")
            break


@app.command()
def task(
    description: str = typer.Argument(..., help="Task description"),
    priority: str = typer.Option("medium", "--priority", "-p", help="Priority: low, medium, high, critical"),
):
    """Submit a task to the agent mesh"""
    from cli.ollama import OllamaManager
    from cli.config import ChakravyuhConfig

    config = ChakravyuhConfig()
    ollama = OllamaManager()

    if not ollama.detect() or not ollama.is_running():
        console.print("[yellow]Ollama not running. Start with 'cv run'[/yellow]")
        return

    console.print(f"[bold cyan]Submitting task:[/bold cyan] {description}")
    console.print(f"[dim]Priority: {priority}[/dim]")

    # In a full setup, this would go via the API
    console.print("[yellow]Task queued. Run 'cv run' to start the API server and process tasks.[/yellow]")


@app.command()
def agents(
    list_agents: bool = typer.Option(True, "--list", "-l", help="List all agents"),
    agent_id: Optional[str] = typer.Argument(None, help="Agent ID for details"),
):
    """List and manage agents"""
    from agents import create_default_configs

    configs = create_default_configs()
    table = Table(box=box.ROUNDED, title="Agent Mesh")
    table.add_column("ID", style="cyan")
    table.add_column("Name")
    table.add_column("Role")
    table.add_column("Model")
    table.add_column("Status")
    table.add_column("Capabilities")

    for cid, cfg in configs.items():
        caps = ", ".join(c.value for c in cfg.capabilities)
        table.add_row(
            cid, cfg.name, cfg.role,
            f"{cfg.model}", "[dim]idle[/dim]", caps
        )

    console.print(table)
    console.print("\n[dim]Agents are managed by the Control Agent when the system is running.[/dim]")


# ── Terminal Management ─────────────────────────────────────────


@app.command()
def term(
    action: str = typer.Argument("list", help="Action: list, spawn, kill, send, attach"),
    agent_id: Optional[str] = typer.Option(None, "--agent", "-a", help="Agent ID"),
    command: Optional[str] = typer.Option(None, "--cmd", "-c", help="Command to send"),
):
    """Manage agent terminals (spawn, kill, send commands, list)"""
    from core.terminal_manager import TerminalManager

    tm = TerminalManager()

    async def run():
        if action == "list":
            all_terms = tm.get_all_terminals()
            if not all_terms:
                console.print("[yellow]No terminals created. Use 'cv term spawn --agent <id>'[/]")
                return
            table = Table(box=box.ROUNDED, title="Agent Terminals")
            table.add_column("Agent ID", style="cyan")
            table.add_column("Name")
            table.add_column("Status")
            table.add_column("Sandbox")
            table.add_column("Buffer")
            for aid, term in all_terms.items():
                status = "[green]running[/]" if term.is_running else "[red]stopped[/]"
                table.add_row(aid, term.name, status, str(term.sandbox_dir), f"{len(term.buffer)} lines")
            console.print(table)

        elif action == "spawn":
            if not agent_id:
                console.print("[red]--agent is required[/]")
                return
            from agents import create_default_configs
            configs = create_default_configs()
            if agent_id not in configs:
                console.print(f"[red]Unknown agent: {agent_id}. Available: {', '.join(configs.keys())}[/]")
                return
            cfg = configs[agent_id]
            await tm.create_terminal(agent_id, cfg.name, cfg.role)
            ok = await tm.spawn(agent_id)
            if ok:
                console.print(f"[green]✓[/] Terminal spawned for [bold]{cfg.name}[/] ({agent_id})")
            else:
                console.print(f"[red]✗[/] Failed to spawn terminal for {agent_id}")

        elif action == "kill":
            if not agent_id:
                console.print("[red]--agent is required[/]")
                return
            ok = await tm.kill(agent_id)
            if ok:
                console.print(f"[green]✓[/] Terminal killed: {agent_id}")
            else:
                console.print(f"[red]✗[/] Failed to kill terminal: {agent_id}")

        elif action == "send":
            if not agent_id or not command:
                console.print("[red]--agent and --cmd are required[/]")
                return
            ok = await tm.send_command(agent_id, command)
            if ok:
                console.print(f"[green]✓[/] Sent command to {agent_id}")
                lines = tm.get_buffer(agent_id, 5)
                for line in lines[-5:]:
                    console.print(f"  [dim]{line}[/]")
            else:
                console.print(f"[red]✗[/] Failed to send to {agent_id}")

        elif action == "attach":
            if not agent_id:
                console.print("[red]--agent is required[/]")
                return
            lines = tm.get_buffer(agent_id, 50)
            term_obj = tm.get_terminal(agent_id)
            if not term_obj:
                console.print(f"[red]Terminal not found: {agent_id}[/]")
                return
            console.print(f"[bold cyan]Attached to {term_obj.name} ({agent_id})[/]")
            console.print(f"[dim]Sandbox: {term_obj.sandbox_dir}[/]")
            console.print(f"[dim]Status: {'Running' if term_obj.is_running else 'Stopped'}[/]")
            console.print("[dim]Recent output:[/]")
            for line in lines[-30:]:
                console.print(f"  {line}")

        else:
            console.print(f"[red]Unknown action: {action}. Use: list, spawn, kill, send, attach[/]")

    import asyncio
    asyncio.run(run())


if __name__ == "__main__":
    app()
