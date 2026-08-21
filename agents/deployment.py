from core.base_agent import BaseAgent


class DeploymentAgent(BaseAgent):
    """Deployment agent — real work loop inherited from BaseAgent.

    System prompt: prompts/deployment.md (loaded automatically).
    Tools and model come from AgentConfig (see agents/__init__.py).
    """
