import logging
import os

import httpx

from tools.base import BaseTool, ToolResult

logger = logging.getLogger("chakravyuh.tools.github")


class GitHubTool(BaseTool):
    name = "github"
    description = "Interact with GitHub API"

    BASE_URL = "https://api.github.com"

    def __init__(self):
        self._token = os.getenv("GITHUB_TOKEN", "")

    async def execute(self, action: str = "list_repos", owner: str = "", repo: str = "", **kwargs) -> ToolResult:
        headers = {"Accept": "application/vnd.github.v3+json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        try:
            async with httpx.AsyncClient(base_url=self.BASE_URL, headers=headers, timeout=15) as client:
                if action == "list_repos":
                    resp = await client.get("/user/repos" if self._token else "/repos/krushna081")
                    resp.raise_for_status()
                    repos = [{"name": r["name"], "description": r.get("description", ""),
                              "stars": r["stargazers_count"], "url": r["html_url"]} for r in resp.json()]
                    return ToolResult(success=True, data={"repos": repos[:20]})

                elif action == "list_issues":
                    if not owner or not repo:
                        return ToolResult(success=False, error="owner and repo required")
                    resp = await client.get(f"/repos/{owner}/{repo}/issues")
                    resp.raise_for_status()
                    issues = [{"number": i["number"], "title": i["title"], "state": i["state"],
                               "url": i["html_url"]} for i in resp.json()]
                    return ToolResult(success=True, data={"issues": issues[:20]})

                elif action == "list_prs":
                    if not owner or not repo:
                        return ToolResult(success=False, error="owner and repo required")
                    resp = await client.get(f"/repos/{owner}/{repo}/pulls")
                    resp.raise_for_status()
                    prs = [{"number": p["number"], "title": p["title"], "state": p["state"],
                            "url": p["html_url"]} for p in resp.json()]
                    return ToolResult(success=True, data={"pulls": prs[:20]})

                else:
                    return ToolResult(success=False, error=f"Unknown action: {action}")

        except Exception as e:
            logger.error(f"GitHub API error: {e}")
            return ToolResult(success=False, error=str(e))
