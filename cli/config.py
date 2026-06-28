from pydantic_settings import BaseSettings
from core.types import RouterMode


class ChakravyuhConfig(BaseSettings):
    router_mode: RouterMode = RouterMode.LOCAL
    ollama_host: str = "http://127.0.0.1:11434"
    ollama_default_model: str = "llama3.1:8b"

    openai_api_key: str = ""
    anthropic_api_key: str = ""
    deepseek_api_key: str = ""
    google_api_key: str = ""
    grok_api_key: str = ""

    memory_backend: str = "sqlite"
    chroma_path: str = "data/chromadb"
    sqlite_path: str = "data/memory.db"

    log_level: str = "INFO"
    api_host: str = "127.0.0.1"
    api_port: int = 3001

    model_config = {"env_prefix": "CHAKRAVYUH_", "env_file": ".env", "extra": "ignore"}
