from core.base_agent import BaseAgent


class ResearcherAgent(BaseAgent):
    """Researcher agent — real work loop inherited from BaseAgent.

    System prompt: prompts/researcher.md (loaded automatically).
    Tools and model come from AgentConfig (see agents/__init__.py).
    """
