from core.base_agent import BaseAgent


class SecurityAgent(BaseAgent):
    """Security agent — real work loop inherited from BaseAgent.

    System prompt: prompts/security.md (loaded automatically).
    Tools and model come from AgentConfig (see agents/__init__.py).
    """
