from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Any, Optional
from datetime import datetime


class AgentStatus(Enum):
    IDLE = "idle"
    ACTIVE = "active"
    PROCESSING = "processing"
    WAITING = "waiting"
    SLEEPING = "sleeping"
    ERROR = "error"


class MessagePriority(Enum):
    LOW = 0
    MEDIUM = 1
    HIGH = 2
    CRITICAL = 3


class TaskStatus(Enum):
    PENDING = "pending"
    ASSIGNED = "assigned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class ProviderType(Enum):
    OLLAMA = "ollama"
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    DEEPSEEK = "deepseek"
    GOOGLE = "google"
    GROK = "grok"
    OPENROUTER = "openrouter"


class RouterMode(Enum):
    LOCAL = "local"
    HYBRID = "hybrid"
    CLOUD = "cloud"


class MemoryType(Enum):
    WORKING = "working"
    EPISODIC = "episodic"
    SEMANTIC = "semantic"
    PROCEDURAL = "procedural"


class AgentCapability(Enum):
    CODE = "code"
    RESEARCH = "research"
    PLANNING = "planning"
    BROWSING = "browsing"
    TESTING = "testing"
    SECURITY = "security"
    DEPLOYMENT = "deployment"
    MEMORY = "memory"
    GITHUB = "github"
    COORDINATION = "coordination"


@dataclass
class ModelInfo:
    name: str
    provider: ProviderType
    capabilities: list[AgentCapability]
    context_length: int
    is_local: bool = True
    cost_per_1k_tokens: float = 0.0
    requires_api_key: bool = False


@dataclass
class AgentConfig:
    id: str
    name: str
    role: str
    system_prompt: str
    provider: ProviderType | str
    model: str
    tools: list[str]
    capabilities: list[AgentCapability]
    memory_scope: list[MemoryType]
    allowed_peers: list[str]
    max_tokens_per_task: int = 4096
    max_consecutive_calls: int = 30
    timeout: int = 120000


@dataclass
class AgentMessage:
    id: str
    from_agent: str
    to_agent: str | list[str]
    type: str  # request, response, broadcast, error
    priority: MessagePriority
    payload: dict[str, Any]
    metadata: dict[str, Any] = field(default_factory=lambda: {
        "timestamp": datetime.now().isoformat(),
        "ttl": 60,
        "trace_id": "",
    })


@dataclass
class Task:
    id: str
    description: str
    agent_id: Optional[str] = None
    status: TaskStatus = TaskStatus.PENDING
    priority: MessagePriority = MessagePriority.MEDIUM
    input_data: dict[str, Any] = field(default_factory=dict)
    output_data: Optional[dict[str, Any]] = None
    error: Optional[str] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    completed_at: Optional[str] = None
    parent_task_id: Optional[str] = None
    subtasks: list[str] = field(default_factory=list)


@dataclass
class WorkflowStep:
    id: str
    agent_id: str
    task_description: str
    input_data: dict[str, Any] = field(default_factory=dict)
    depends_on: list[str] = field(default_factory=list)
    status: TaskStatus = TaskStatus.PENDING


@dataclass
class Workflow:
    id: str
    name: str
    description: str
    steps: list[WorkflowStep]
    status: str = "pending"
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())


@dataclass
class MemoryEntry:
    id: str
    agent_id: str
    type: MemoryType
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    timestamp: str = field(default_factory=lambda: datetime.now().isoformat())
    embedding: Optional[list[float]] = None


@dataclass
class MemoryQuery:
    query: str
    type: Optional[MemoryType] = None
    agent_id: Optional[str] = None
    limit: int = 10
    threshold: float = 0.7


@dataclass
class SystemState:
    engine_status: str = "stopped"
    active_agents: int = 0
    total_agents: int = 0
    active_tasks: int = 0
    queued_tasks: int = 0
    ollama_connected: bool = False
    ollama_models: list[str] = field(default_factory=list)
    memory_usage: str = "0 MB"
    uptime: str = "0s"
    router_mode: RouterMode = RouterMode.LOCAL
