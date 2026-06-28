import asyncio
import logging
from datetime import datetime

from textual import work
from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical, ScrollableContainer
from textual.widgets import Header, Footer, Static, Input, Button, Label, RichLog, ListView, ListItem, TabbedContent, TabPane
from textual.reactive import reactive
from textual.screen import Screen

logger = logging.getLogger("chakravyuh.tui")

AGENT_DEFS = {
    "coordinator": ("Coordinator", "Task routing & delegation"),
    "planner": ("Planner", "Goal decomposition & planning"),
    "coder": ("Coder", "Write, review & refactor code"),
    "researcher": ("Researcher", "Information gathering & analysis"),
    "browser": ("Browser", "Web automation & interaction"),
    "qa": ("QA", "Testing, validation & QA"),
    "memory_agent": ("Memory Agent", "Memory management & retrieval"),
    "security": ("Security Agent", "Security analysis & threat detection"),
    "github": ("GitHub Agent", "Repository management & automation"),
    "deployment": ("Deployment Agent", "Build, deploy & infrastructure"),
}

AGENT_COLORS = {
    "coordinator": "ansicyan",
    "planner": "ansiblue",
    "coder": "ansimagenta",
    "researcher": "ansiyellow",
    "browser": "ansipink",
    "qa": "ansigreen",
    "memory_agent": "ansiteal",
    "security": "ansired",
    "github": "ansiblue",
    "deployment": "ansiyellow",
}


class AgentTerminalPanel(Static):
    def __init__(self, agent_id: str, name: str, role: str):
        super().__init__()
        self.agent_id = agent_id
        self.agent_name = name
        self.agent_role = role
        self.color = AGENT_COLORS.get(agent_id, "white")

    def compose(self) -> ComposeResult:
        yield Label(f"[bold {self.color}]\\u25A0 {self.agent_name}[/] [dim]{self.agent_role}[/dim]", id=f"label-{self.agent_id}")
        yield RichLog(id=f"log-{self.agent_id}", highlight=True, max_lines=200)

    def on_mount(self):
        self.styles.border = ("solid", self.color)
        self.styles.height = "100%"
        self.styles.margin = (0, 1)

    async def append_output(self, text: str):
        log = self.query_one(f"#log-{self.agent_id}", RichLog)
        timestamp = datetime.now().strftime("%H:%M:%S")
        log.write(f"[dim]{timestamp}[/] {text}")

    async def clear_output(self):
        log = self.query_one(f"#log-{self.agent_id}", RichLog)
        log.clear()


class PromptEngineerPanel(Static):
    def compose(self) -> ComposeResult:
        yield Label("[bold white]PROMPT ENGINEER[/bold white] — Type a task and choose target agents", id="pe-label")
        yield Input(placeholder="Describe what you want the agents to do...", id="pe-input")
        with Horizontal(id="pe-controls"):
            yield Button("Send to All Agents", id="btn-all", variant="primary")
            for aid in AGENT_DEFS:
                yield Button(AGENT_DEFS[aid][0].split()[0], id=f"btn-{aid}", classes="agent-btn")
        yield RichLog(id="pe-log", highlight=True, max_lines=100)

    def on_mount(self):
        self.styles.border = ("solid", "white")
        self.styles.height = "auto"
        self.styles.margin = (0, 1)


class StatusBar(Static):
    status_text = reactive("Initializing...")

    def on_mount(self):
        self.styles.height = "3"
        self.styles.background = "ansiblack"
        self.styles.color = "ansigreen"

    def watch_status_text(self, text: str):
        self.update(text)


class ChakravyuhCommandCenter(App):
    TITLE = "Chakravyuh AI — Command Center"
    CSS = """
    Screen {
        background: #0a0a0f;
    }
    #main-layout {
        height: 100%;
    }
    #prompt-panel {
        height: auto;
        min-height: 8;
        margin-bottom: 1;
    }
    #pe-input {
        margin: 0 1;
    }
    #pe-controls {
        margin: 0 1;
        height: 3;
    }
    .agent-btn {
        margin: 0 1;
        min-width: 10;
    }
    #pe-log {
        height: 8;
        margin: 1;
        border: solid $surface;
    }
    #agent-grid {
        height: 1fr;
    }
    #status-bar {
        height: 1;
        background: $surface;
        color: $text;
    }
    """

    def __init__(self, terminal_manager=None, prompt_engineer=None):
        super().__init__()
        self._tm = terminal_manager
        self._pe = prompt_engineer
        self._agent_panels: dict[str, AgentTerminalPanel] = {}

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)
        with Vertical(id="main-layout"):
            yield PromptEngineerPanel(id="prompt-panel")
            with ScrollableContainer(id="agent-grid"):
                with Horizontal():
                    for aid, (name, role) in AGENT_DEFS.items():
                        panel = AgentTerminalPanel(aid, name, role)
                        self._agent_panels[aid] = panel
                        yield panel
            yield StatusBar("[dim]Agents: 10 | Status: idle | Press Ctrl+C to quit[/dim]")

    def on_mount(self):
        self.query_one("#pe-input", Input).focus()
        self._init_terminals()

    async def _init_terminals(self):
        if self._tm:
            for aid, (name, role) in AGENT_DEFS.items():
                panel = self._agent_panels.get(aid)
                if panel:
                    await panel.append_output(f"[yellow]Initializing terminal for {name}...[/]")
            await self._tm.spawn_all_agents(AGENT_DEFS)
            status_bar = self.query_one(StatusBar)
            status_bar.status_text = "[green]All agent terminals spawned | Ready[/]"
        else:
            sb = self.query_one(StatusBar)
            sb.status_text = "[yellow]Terminal manager not connected | Demo mode[/]"
            for aid, (name, role) in AGENT_DEFS.items():
                panel = self._agent_panels.get(aid)
                if panel:
                    await panel.append_output(f"[dim]Demo mode — terminal {name} ready[/]")

    def on_input_submitted(self, event: Input.Submitted):
        if event.input.id == "pe-input":
            self._process_input(event.value)

    def on_button_pressed(self, event: Button.Pressed):
        if event.button.id == "btn-all":
            self._process_input(self.query_one("#pe-input", Input).value, target_all=True)
        elif event.button.id and event.button.id.startswith("btn-"):
            agent_id = event.button.id.replace("btn-", "")
            self._process_input(self.query_one("#pe-input", Input).value, target=agent_id)

    async def _process_input(self, text: str, target: str = None, target_all: bool = False):
        if not text.strip():
            return

        pe_log = self.query_one("#pe-log", RichLog)
        pe_input = self.query_one("#pe-input", Input)

        pe_log.write(f"[bold white]>[/] {text}")

        if target_all:
            pe_log.write("[dim]Sending to all agents...[/]")
            for aid, panel in self._agent_panels.items():
                await panel.append_output(f"[bold]{text}[/]")
                if self._pe:
                    await self._pe.process_task(f"[TO {AGENT_DEFS[aid][0]}] {text}")
            pe_log.write("[green]Dispatched to all agents[/]")
        elif target and target in self._agent_panels:
            panel = self._agent_panels[target]
            await panel.append_output(f"[bold]{text}[/]")
            if self._pe:
                result = await self._pe.process_task(f"[TO {AGENT_DEFS[target][0]}] {text}")
                pe_log.write(f"[dim]Sent to {AGENT_DEFS[target][0]}: {result['status']}[/]")
        else:
            pe_log.write("[yellow]Analyzing task and routing to right agents...[/]")
            if self._pe:
                result = await self._pe.process_task(text)
                engaged = result.get("agents_engaged", 0)
                targets = result.get("targets", [])
                pe_log.write(f"[green]Engaged {engaged} agents: {', '.join(targets)}[/]")
                for t in targets:
                    await self._show_agent_output(t, text)
            else:
                pe_log.write("[dim]Prompt Engineer not connected[/]")

        pe_input.clear()
        pe_input.focus()

    async def _show_agent_output(self, agent_id: str, text: str):
        panel = self._agent_panels.get(agent_id)
        if not panel:
            return
        await panel.append_output(f"[bold white]Task: {text[:80]}...[/]")
        if self._tm:
            lines = self._tm.get_buffer(agent_id, 20)
            for line in lines:
                await panel.append_output(line)

    def key_f1(self):
        self._focus_agent("coordinator")

    def key_f2(self):
        self._focus_agent("planner")

    def key_f3(self):
        self._focus_agent("coder")

    def key_f4(self):
        self._focus_agent("researcher")

    def key_f5(self):
        self._focus_agent("browser")

    def key_f6(self):
        self._focus_agent("qa")

    def key_f7(self):
        self._focus_agent("memory_agent")

    def key_f8(self):
        self._focus_agent("security")

    def key_f9(self):
        self._focus_agent("github")

    def key_f10(self):
        self._focus_agent("deployment")

    def _focus_agent(self, agent_id: str):
        panel = self._agent_panels.get(agent_id)
        if panel:
            panel.focus()
            self.query_one("#pe-input", Input).focus()
            sb = self.query_one(StatusBar)
            name = AGENT_DEFS[agent_id][0]
            sb.status_text = f"[bold]Watching:[/] {name} | F1-F10 to switch agents"
