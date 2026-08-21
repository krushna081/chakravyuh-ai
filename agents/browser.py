from core.base_agent import BaseAgent


class BrowserAgent(BaseAgent):
    """Browser agent — real work loop inherited from BaseAgent.

    System prompt: prompts/browser.md (loaded automatically).
    Tools and model come from AgentConfig (see agents/__init__.py).
    """
