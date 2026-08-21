from core.base_agent import BaseAgent


class QAAgent(BaseAgent):
    """Qa agent — real work loop inherited from BaseAgent.

    System prompt: prompts/qa.md (loaded automatically).
    Tools and model come from AgentConfig (see agents/__init__.py).
    """
