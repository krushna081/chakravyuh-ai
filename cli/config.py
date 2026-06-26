"""Configuration loader for Chakravyuh AI."""

import os
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings


class ChakravyuhConfig(BaseSettings):
    """Application configuration from environment variables."""

    # Server
    host: str = "127.0.0.1"
    port: int = 3001
    log_level: str = "info"
    secret_key: str = ""

    # Default provider
    default_provider: Literal["ollama", "openai", "anthropic", "google", "deepseek"] = "ollama"
    model_router_mode: Literal["local", "hybrid", "cloud"] = "local"

    # Ollama
    ollama_base_url: str = "http://127.0.0.1:11434"
    ollama_chat_model: str = "llama3.1:8b"
    ollama_embed_model: str = "nomic-embed-text:v1.5"
    ollama_auto_pull: bool = True

    # Security
    allowed_origins: str = "http://127.0.0.1:3001,http://localhost:3001"

    # Memory
    memory_backend: Literal["sqlite", "chromadb", "filesystem"] = "sqlite"
    chroma_db_url: str = "http://127.0.0.1:8100"

    # MCP
    mcp_enabled: bool = True

    model_config = {"env_file": ".env", "env_prefix": "chakravyuh_"}


config = ChakravyuhConfig()
