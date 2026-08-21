from core.base_agent import BaseAgent


class CoordinatorAgent(BaseAgent):
    """Coordinator agent — real work loop inherited from BaseAgent.

    System prompt: prompts/coordinator.md (loaded automatically).
    Tools and model come from AgentConfig (see agents/__init__.py).
    """
