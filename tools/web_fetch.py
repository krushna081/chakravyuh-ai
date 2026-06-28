import logging

import httpx

from tools.base import BaseTool, ToolResult

logger = logging.getLogger("chakravyuh.tools.web_fetch")


class WebFetchTool(BaseTool):
    name = "web_fetch"
    description = "Fetch content from URLs"

    async def execute(self, url: str = "", **kwargs) -> ToolResult:
        if not url:
            return ToolResult(success=False, error="URL is required")

        try:
            async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Chakravyuh-AI/0.2"})
                resp.raise_for_status()
                content_type = resp.headers.get("content-type", "")
                text = resp.text
                return ToolResult(success=True, data={
                    "url": url,
                    "status": resp.status_code,
                    "content_type": content_type,
                    "content_length": len(text),
                    "content": text[:10000],
                })
        except httpx.HTTPStatusError as e:
            return ToolResult(success=False, error=f"HTTP {e.response.status_code}")
        except httpx.RequestError as e:
            return ToolResult(success=False, error=f"Request failed: {e}")
        except Exception as e:
            logger.error(f"Web fetch error: {e}")
            return ToolResult(success=False, error=str(e))
