from datetime import datetime

from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical
from textual.widgets import Header, Footer, Static, Label, ListView, ListItem, RichLog, TabbedContent, TabPane, Button


class StatusWidget(Static):
    def on_mount(self):
        self.set_interval(2, self.refresh_status)
        self.refresh_status()

    def refresh_status(self):
        from cli.ollama import OllamaManager
        ollama = OllamaManager()
        ollama_ok = ollama.detect() and ollama.is_running()

        models = []
        if ollama_ok:
            models = [m["name"] for m in ollama.list_models()[:4]]

        status_lines = [
            f"[bold cyan]Chakravyuh AI[/bold cyan] — [bold]Multi-Agent Command Center[/bold]",
            f"",
            f"[bold]Ollama:[/bold] {'[green]Running[/green]' if ollama_ok else '[red]Not found[/red]'}",
            f"[bold]Models:[/bold] {', '.join(models) if models else 'None'}",
            f"[bold]Agents:[/bold] 10 registered, 0 active",
            f"[bold]Memory:[/bold] 0 entries",
            f"[bold]Status:[/bold] [yellow]Standing by[/yellow]",
            f"",
            f"[dim]Last updated: {datetime.now().strftime('%H:%M:%S')}[/dim]",
        ]
        self.update("\n".join(status_lines))


class AgentList(ListView):
    def on_mount(self):
        self._populate()

    def _populate(self):
        from agents import create_default_configs
        configs = create_default_configs()
        self.clear()
        for cid, cfg in configs.items():
            self.append(ListItem(Label(f"[bold]{cfg.name}[/bold] — {cfg.role} [dim]({cfg.model})[/dim]")))


class LogWidget(RichLog):
    def on_mount(self):
        self._log_count = 0
        self.set_interval(5, self._add_sample_log)
        self._add_sample_log()

    def _add_sample_log(self):
        self._log_count += 1
        from datetime import datetime
        ts = datetime.now().strftime("%H:%M:%S")
        self.write(f"[dim]{ts}[/dim] [green]INFO[/green] System standing by (tick {self._log_count})")


class ChakravyuhTUI(App):
    TITLE = "Chakravyuh AI — Command Center"
    CSS = """
    Screen {
        background: #0a0a0f;
    }
    StatusWidget {
        padding: 1;
        border: solid $primary;
        height: auto;
    }
    #agent-panel {
        height: 100%;
    }
    ListView {
        height: 100%;
    }
    RichLog {
        height: 100%;
        border: solid $surface;
    }
    Button {
        margin: 1;
    }
    """

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Horizontal():
            with Vertical(id="agent-panel"):
                yield StatusWidget()
                yield Static("[bold]Agents[/bold]", classes="section-title")
                yield AgentList()
            with Vertical():
                with TabbedContent():
                    with TabPane("Logs", id="logs"):
                        yield LogWidget()
                    with TabPane("Tasks", id="tasks"):
                        yield Static("No active tasks")
                    with TabPane("Memory", id="memory"):
                        yield Static("Memory stats: 0 entries")
        yield Footer()
