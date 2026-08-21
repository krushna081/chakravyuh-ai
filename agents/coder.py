from core.base_agent import BaseAgent


class CoderAgent(BaseAgent):
    """Coder agent — real work loop inherited from BaseAgent.

    System prompt: prompts/coder.md (loaded automatically).
    Tools and model come from AgentConfig (see agents/__init__.py).
    """
