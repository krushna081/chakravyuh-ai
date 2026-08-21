from core.base_agent import BaseAgent


class GitHubAgent(BaseAgent):
    """Github agent — real work loop inherited from BaseAgent.

    System prompt: prompts/github.md (loaded automatically).
    Tools and model come from AgentConfig (see agents/__init__.py).
    """
