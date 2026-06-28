from agents.coordinator import CoordinatorAgent
from agents.coder import CoderAgent
from agents.planner import PlannerAgent
from agents.researcher import ResearcherAgent
from agents.browser import BrowserAgent
from agents.qa import QAAgent
from agents.memory_agent import MemoryAgent
from agents.security import SecurityAgent
from agents.github import GitHubAgent
from agents.deployment import DeploymentAgent

AGENT_REGISTRY = {
    "coordinator": CoordinatorAgent,
    "coder": CoderAgent,
    "planner": PlannerAgent,
    "researcher": ResearcherAgent,
    "browser": BrowserAgent,
    "qa": QAAgent,
    "memory_agent": MemoryAgent,
    "security": SecurityAgent,
    "github": GitHubAgent,
    "deployment": DeploymentAgent,
}


def create_default_configs():
    from core.types import AgentConfig, ProviderType, AgentCapability, MemoryType

    return {
        "coordinator": AgentConfig(
            id="coordinator", name="Coordinator", role="Task routing & delegation",
            system_prompt="You are the coordinator agent. Route tasks to the right specialist agents.",
            provider=ProviderType.OLLAMA, model="llama3.1:8b",
            tools=[], capabilities=[AgentCapability.COORDINATION],
            memory_scope=[MemoryType.WORKING],
            allowed_peers=["planner", "coder", "researcher", "qa"],
        ),
        "planner": AgentConfig(
            id="planner", name="Planner", role="Goal decomposition & planning",
            system_prompt="You break down complex goals into step-by-step plans.",
            provider=ProviderType.OLLAMA, model="llama3.1:8b",
            tools=[], capabilities=[AgentCapability.PLANNING],
            memory_scope=[MemoryType.WORKING, MemoryType.EPISODIC],
            allowed_peers=["coordinator"],
        ),
        "coder": AgentConfig(
            id="coder", name="Coder", role="Write, review & refactor code",
            system_prompt="You write clean, well-documented code. Review and refactor existing code.",
            provider=ProviderType.OLLAMA, model="qwen2.5:7b",
            tools=["filesystem", "terminal"], capabilities=[AgentCapability.CODE],
            memory_scope=[MemoryType.WORKING, MemoryType.EPISODIC, MemoryType.PROCEDURAL],
            allowed_peers=["coordinator", "planner", "qa", "researcher"],
        ),
        "researcher": AgentConfig(
            id="researcher", name="Researcher", role="Information gathering & analysis",
            system_prompt="You research topics thoroughly using web search and synthesize findings.",
            provider=ProviderType.OLLAMA, model="llama3.1:8b",
            tools=["web_fetch", "web_search"], capabilities=[AgentCapability.RESEARCH],
            memory_scope=[MemoryType.WORKING, MemoryType.EPISODIC, MemoryType.SEMANTIC],
            allowed_peers=["coordinator", "coder", "planner"],
        ),
        "browser": AgentConfig(
            id="browser", name="Browser", role="Web automation & interaction",
            system_prompt="You automate browser interactions: navigate, click, fill forms, extract data.",
            provider=ProviderType.OLLAMA, model="mistral:7b",
            tools=["browser"], capabilities=[AgentCapability.BROWSING],
            memory_scope=[MemoryType.WORKING, MemoryType.EPISODIC],
            allowed_peers=["coordinator", "researcher"],
        ),
        "qa": AgentConfig(
            id="qa", name="QA", role="Testing, validation & quality assurance",
            system_prompt="You test code, validate outputs, and ensure quality standards.",
            provider=ProviderType.OLLAMA, model="gemma2:9b",
            tools=["filesystem", "terminal"], capabilities=[AgentCapability.TESTING],
            memory_scope=[MemoryType.WORKING, MemoryType.EPISODIC],
            allowed_peers=["coordinator", "coder", "planner"],
        ),
        "memory_agent": AgentConfig(
            id="memory_agent", name="Memory Agent", role="Memory management & retrieval",
            system_prompt="You manage the memory system: store, retrieve, and prune memories.",
            provider=ProviderType.OLLAMA, model="nomic-embed-text",
            tools=[], capabilities=[AgentCapability.MEMORY],
            memory_scope=[MemoryType.WORKING, MemoryType.EPISODIC, MemoryType.SEMANTIC, MemoryType.PROCEDURAL],
            allowed_peers=["coordinator", "*"],
        ),
        "security": AgentConfig(
            id="security", name="Security Agent", role="Security analysis & threat detection",
            system_prompt="You analyze code and configurations for security vulnerabilities.",
            provider=ProviderType.OLLAMA, model="llama3.1:8b",
            tools=["filesystem"], capabilities=[AgentCapability.SECURITY],
            memory_scope=[MemoryType.EPISODIC, MemoryType.SEMANTIC],
            allowed_peers=["coordinator", "coder", "github"],
        ),
        "github": AgentConfig(
            id="github", name="GitHub Agent", role="Repository management & automation",
            system_prompt="You manage GitHub repositories: issues, PRs, commits, and workflows.",
            provider=ProviderType.OLLAMA, model="qwen2.5:7b",
            tools=["github"], capabilities=[AgentCapability.GITHUB],
            memory_scope=[MemoryType.WORKING, MemoryType.EPISODIC],
            allowed_peers=["coordinator", "coder", "security"],
        ),
        "deployment": AgentConfig(
            id="deployment", name="Deployment Agent", role="Build, deploy & infrastructure",
            system_prompt="You handle builds, deployments, Docker, CI/CD, and infrastructure.",
            provider=ProviderType.OLLAMA, model="phi3:14b",
            tools=["filesystem", "terminal", "docker"], capabilities=[AgentCapability.DEPLOYMENT],
            memory_scope=[MemoryType.WORKING, MemoryType.EPISODIC, MemoryType.PROCEDURAL],
            allowed_peers=["coordinator", "coder", "qa"],
        ),
    }


def create_all_agents():
    from core.types import AgentConfig, ProviderType, AgentCapability, MemoryType
    configs = create_default_configs()
    agents = {}
    for agent_id, config in configs.items():
        cls = AGENT_REGISTRY.get(agent_id)
        if cls:
            agents[agent_id] = cls(config)
    return agents
