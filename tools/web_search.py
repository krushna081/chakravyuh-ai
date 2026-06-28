import logging
import urllib.parse

import httpx

from tools.base import BaseTool, ToolResult

logger = logging.getLogger("chakravyuh.tools.web_search")


class WebSearchTool(BaseTool):
    name = "web_search"
    description = "Search the web using DuckDuckGo"

    async def execute(self, query: str = "", max_results: int = 5, **kwargs) -> ToolResult:
        if not query:
            return ToolResult(success=False, error="Query is required")

        try:
            encoded = urllib.parse.quote(query)
            url = f"https://html.duckduckgo.com/html/?q={encoded}"
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                })
                resp.raise_for_status()

            from html.parser import HTMLParser

            class SearchParser(HTMLParser):
                def __init__(self):
                    super().__init__()
                    self.results = []
                    self._in_result = False
                    self._in_title = False
                    self._in_snippet = False
                    self._current = {}

                def handle_starttag(self, tag, attrs):
                    attrs = dict(attrs)
                    if tag == "a" and "result__a" in attrs.get("class", ""):
                        self._in_title = True
                        self._current = {"url": attrs.get("href", "")}
                    if tag == "a" and "result__snippet" in attrs.get("class", ""):
                        self._in_snippet = True

                def handle_data(self, data):
                    if self._in_title:
                        self._current["title"] = data.strip()
                    if self._in_snippet:
                        self._current.setdefault("snippet", "")
                        self._current["snippet"] += data.strip()

                def handle_endtag(self, tag):
                    if tag == "a" and self._in_title:
                        self._in_title = False
                        if self._current.get("title"):
                            self.results.append(self._current)
                        self._current = {}
                    if tag == "a" and self._in_snippet:
                        self._in_snippet = False

            parser = SearchParser()
            parser.feed(resp.text)

            results = parser.results[:max_results]
            return ToolResult(success=True, data={
                "query": query,
                "results_count": len(results),
                "results": results,
            })

        except Exception as e:
            logger.error(f"Web search error: {e}")
            return ToolResult(success=False, error=str(e))
