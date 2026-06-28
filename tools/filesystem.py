import os
import logging
from pathlib import Path

from tools.base import BaseTool, ToolResult

logger = logging.getLogger("chakravyuh.tools.filesystem")


class FilesystemTool(BaseTool):
    name = "filesystem"
    description = "Read, write, list, and manage files"

    def __init__(self, sandbox_path: str | None = None):
        self._sandbox = Path(sandbox_path or os.getcwd()).resolve()

    def _resolve_path(self, path: str) -> Path:
        p = self._sandbox / path
        return p.resolve()

    def _validate_path(self, path: Path) -> bool:
        return str(path).startswith(str(self._sandbox))

    async def execute(self, action: str = "list", path: str = "", content: str = "", **kwargs) -> ToolResult:
        try:
            resolved = self._resolve_path(path)
            if not self._validate_path(resolved):
                return ToolResult(success=False, error="Path outside sandbox")

            if action == "list":
                if not resolved.exists():
                    return ToolResult(success=False, error=f"Path does not exist: {path}")
                items = []
                for f in resolved.iterdir() if resolved.is_dir() else [resolved]:
                    items.append({
                        "name": f.name,
                        "type": "directory" if f.is_dir() else "file",
                        "size": f.stat().st_size if f.is_file() else 0,
                    })
                return ToolResult(success=True, data={"path": path, "items": items})

            elif action == "read":
                if not resolved.is_file():
                    return ToolResult(success=False, error=f"Not a file: {path}")
                content = resolved.read_text(encoding="utf-8")
                return ToolResult(success=True, data={"path": path, "content": content, "size": len(content)})

            elif action == "write":
                resolved.parent.mkdir(parents=True, exist_ok=True)
                resolved.write_text(content, encoding="utf-8")
                return ToolResult(success=True, data={"path": path, "bytes_written": len(content)})

            elif action == "delete":
                if resolved.is_file():
                    resolved.unlink()
                elif resolved.is_dir():
                    import shutil
                    shutil.rmtree(resolved)
                return ToolResult(success=True, data={"path": path, "deleted": True})

            elif action == "mkdir":
                resolved.mkdir(parents=True, exist_ok=True)
                return ToolResult(success=True, data={"path": path, "created": True})

            else:
                return ToolResult(success=False, error=f"Unknown action: {action}")

        except Exception as e:
            logger.error(f"Filesystem error: {e}")
            return ToolResult(success=False, error=str(e))
