from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass
class ToolResult:
    success: bool
    data: Any = None
    error: Optional[str] = None
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseTool:
    name: str = ""
    description: str = ""

    async def execute(self, **kwargs) -> ToolResult:
        raise NotImplementedError

    def validate_params(self, **kwargs) -> tuple[bool, str]:
        return True, ""
