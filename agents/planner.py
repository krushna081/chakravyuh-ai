from core.base_agent import BaseAgent


class PlannerAgent(BaseAgent):
    """Planner agent — real work loop inherited from BaseAgent.

    System prompt: prompts/planner.md (loaded automatically).
    Tools and model come from AgentConfig (see agents/__init__.py).
    """
