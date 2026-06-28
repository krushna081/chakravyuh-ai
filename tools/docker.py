import asyncio
import logging

from tools.base import BaseTool, ToolResult

logger = logging.getLogger("chakravyuh.tools.docker")


class DockerTool(BaseTool):
    name = "docker"
    description = "Manage Docker containers and images"

    async def execute(self, action: str = "ps", **kwargs) -> ToolResult:
        try:
            if action == "ps":
                proc = await asyncio.create_subprocess_shell(
                    "docker ps --format '{{.ID}}\t{{.Image}}\t{{.Status}}\t{{.Names}}'",
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await proc.communicate()
                containers = []
                for line in stdout.decode().strip().split("\n"):
                    if line.strip():
                        parts = line.split("\t")
                        containers.append({
                            "id": parts[0] if len(parts) > 0 else "",
                            "image": parts[1] if len(parts) > 1 else "",
                            "status": parts[2] if len(parts) > 2 else "",
                            "name": parts[3] if len(parts) > 3 else "",
                        })
                return ToolResult(success=True, data={"containers": containers})

            elif action == "images":
                proc = await asyncio.create_subprocess_shell(
                    "docker images --format '{{.Repository}}:{{.Tag}}\t{{.Size}}'",
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await proc.communicate()
                images = []
                for line in stdout.decode().strip().split("\n"):
                    if line.strip():
                        parts = line.split("\t")
                        images.append({"name": parts[0] if len(parts) > 0 else "",
                                       "size": parts[1] if len(parts) > 1 else ""})
                return ToolResult(success=True, data={"images": images})

            elif action == "compose_ps":
                proc = await asyncio.create_subprocess_shell(
                    "docker compose ps --format json" if kwargs.get("file") == ""
                    else f"docker compose -f {kwargs.get('file', 'docker-compose.yml')} ps --format json",
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await proc.communicate()
                return ToolResult(success=True, data={"services": stdout.decode()[:2000]})

            else:
                return ToolResult(success=False, error=f"Unknown action: {action}")

        except FileNotFoundError:
            return ToolResult(success=False, error="Docker not found")
        except Exception as e:
            logger.error(f"Docker error: {e}")
            return ToolResult(success=False, error=str(e))
