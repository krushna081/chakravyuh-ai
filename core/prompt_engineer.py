import logging
import re
import uuid
from datetime import datetime
from typing import Any, Optional

from core.terminal_manager import TerminalManager

logger = logging.getLogger("chakravyuh.prompt_engineer")


class PromptEngineer:
    def __init__(self, terminal_manager: TerminalManager):
        self._tm = terminal_manager
        self._history: list[dict] = []
        self._max_history = 200

    async def process_task(self, user_input: str) -> dict[str, Any]:
        task_id = uuid.uuid4().hex[:12]
        logger.info(f"Processing task [{task_id}]: {user_input[:100]}")

        analysis = self._analyze_task(user_input)
        targets = analysis["targets"]

        if not targets:
            return {
                "task_id": task_id,
                "status": "no_agents_matched",
                "message": "Could not determine which agents to involve. Available: " +
                    ", ".join(self._tm.get_all_terminals().keys()),
                "analysis": analysis,
            }

        results = {}
        for target in targets:
            agent_id = target["agent_id"]
            prompt = self._craft_prompt(target, user_input)

            agent_term = self._tm.get_terminal(agent_id)
            if not agent_term:
                results[agent_id] = {"status": "no_terminal"}
                continue

            if not agent_term.is_running:
                await self._tm.spawn(agent_id)

            sent = await self._tm.send_prompt(agent_id, prompt)
            results[agent_id] = {
                "status": "prompt_sent" if sent else "send_failed",
                "prompt_preview": prompt[:200],
                "role": target["role"],
            }

        entry = {
            "task_id": task_id,
            "user_input": user_input,
            "analysis": analysis,
            "results": results,
            "timestamp": datetime.now().isoformat(),
        }
        self._history.append(entry)
        if len(self._history) > self._max_history:
            self._history.pop(0)

        return {
            "task_id": task_id,
            "status": "dispatched",
            "agents_engaged": len(targets),
            "targets": [t["agent_id"] for t in targets],
            "results": results,
        }

    def _analyze_task(self, user_input: str) -> dict[str, Any]:
        text = user_input.lower()

        keywords_to_agents = {
            "planner": {"agent_id": "planner", "role": "Goal decomposition & planning", "confidence": 0.7},
            "plan": {"agent_id": "planner", "role": "Goal decomposition & planning", "confidence": 0.6},
            "strategy": {"agent_id": "planner", "role": "Goal decomposition & planning", "confidence": 0.6},
            "code": {"agent_id": "coder", "role": "Write, review & refactor code", "confidence": 0.8},
            "implement": {"agent_id": "coder", "role": "Write, review & refactor code", "confidence": 0.7},
            "write": {"agent_id": "coder", "role": "Write, review & refactor code", "confidence": 0.5},
            "program": {"agent_id": "coder", "role": "Write, review & refactor code", "confidence": 0.7},
            "research": {"agent_id": "researcher", "role": "Information gathering & analysis", "confidence": 0.8},
            "search": {"agent_id": "researcher", "role": "Information gathering & analysis", "confidence": 0.7},
            "find": {"agent_id": "researcher", "role": "Information gathering & analysis", "confidence": 0.6},
            "browse": {"agent_id": "browser", "role": "Web automation & interaction", "confidence": 0.8},
            "scrape": {"agent_id": "browser", "role": "Web automation & interaction", "confidence": 0.7},
            "test": {"agent_id": "qa", "role": "Testing, validation & QA", "confidence": 0.8},
            "qa": {"agent_id": "qa", "role": "Testing, validation & QA", "confidence": 0.7},
            "validate": {"agent_id": "qa", "role": "Testing, validation & QA", "confidence": 0.6},
            "deploy": {"agent_id": "deployment", "role": "Build, deploy & infrastructure", "confidence": 0.8},
            "release": {"agent_id": "deployment", "role": "Build, deploy & infrastructure", "confidence": 0.7},
            "build": {"agent_id": "deployment", "role": "Build, deploy & infrastructure", "confidence": 0.6},
            "docker": {"agent_id": "deployment", "role": "Build, deploy & infrastructure", "confidence": 0.7},
            "github": {"agent_id": "github", "role": "Repository management & automation", "confidence": 0.8},
            "git": {"agent_id": "github", "role": "Repository management & automation", "confidence": 0.6},
            "pr": {"agent_id": "github", "role": "Repository management & automation", "confidence": 0.7},
            "security": {"agent_id": "security", "role": "Security analysis & threat detection", "confidence": 0.8},
            "audit": {"agent_id": "security", "role": "Security analysis & threat detection", "confidence": 0.7},
            "vulnerability": {"agent_id": "security", "role": "Security analysis & threat detection", "confidence": 0.8},
            "remember": {"agent_id": "memory_agent", "role": "Memory management & retrieval", "confidence": 0.7},
            "memory": {"agent_id": "memory_agent", "role": "Memory management & retrieval", "confidence": 0.6},
        }

        matched = set()
        targets = []
        for keyword, info in keywords_to_agents.items():
            if keyword in text and info["agent_id"] not in matched:
                targets.append(info)
                matched.add(info["agent_id"])

        if not targets:
            targets.append({
                "agent_id": "coordinator",
                "role": "Task routing & delegation",
                "confidence": 0.5,
            })

        return {
            "targets": targets,
            "keywords_found": [k for k in keywords_to_agents if k in text],
            "task_type": self._classify_task(text),
        }

    def _classify_task(self, text: str) -> str:
        if any(w in text for w in ["code", "implement", "write", "program", "function", "class"]):
            return "development"
        if any(w in text for w in ["research", "search", "find", "investigate", "analyze"]):
            return "research"
        if any(w in text for w in ["deploy", "release", "build", "docker", "ci/cd"]):
            return "devops"
        if any(w in text for w in ["test", "qa", "validate", "verify"]):
            return "testing"
        if any(w in text for w in ["security", "audit", "vulnerability"]):
            return "security"
        if any(w in text for w in ["plan", "strategy", "roadmap"]):
            return "planning"
        return "general"

    def _craft_prompt(self, target: dict, user_input: str) -> str:
        agent_id = target["agent_id"]
        role = target["role"]

        prompt_prefixes = {
            "coder": "You are the Coder agent. Your job is to write, review, and refactor code.\n"
                     "Task: write the code, provide the implementation, and ensure it works.\n"
                     "Use the filesystem to read/write files as needed.\n\n",
            "planner": "You are the Planner agent. Your job is to break down complex goals into step-by-step plans.\n"
                       "Task: analyze this request and create a detailed plan with actionable steps.\n\n",
            "researcher": "You are the Researcher agent. Your job is to gather information and analyze it.\n"
                          "Task: research this topic thoroughly. Use web search if available.\n"
                          "Provide a comprehensive summary of findings.\n\n",
            "browser": "You are the Browser agent. Your job is to automate web interactions.\n"
                       "Task: browse, navigate, and extract information from the web.\n\n",
            "qa": "You are the QA agent. Your job is to test, validate, and ensure quality.\n"
                  "Task: review the work and run tests. Report any issues found.\n\n",
            "memory_agent": "You are the Memory Agent. Your job is to manage memories.\n"
                            "Task: store, retrieve, or process memories as described.\n\n",
            "security": "You are the Security Agent. Your job is to analyze for vulnerabilities.\n"
                        "Task: audit the code/project for security issues.\n"
                        "Report critical, high, medium, and low findings.\n\n",
            "github": "You are the GitHub Agent. Your job is to manage repositories.\n"
                      "Task: perform GitHub operations as described.\n\n",
            "deployment": "You are the Deployment Agent. Your job is to build and deploy.\n"
                          "Task: plan and execute the deployment. Check Docker, CI/CD, infrastructure.\n\n",
            "coordinator": "You are the Coordinator. Your job is to route tasks to the right specialists.\n"
                           "Task: analyze this request and determine which specialist agents are needed.\n\n",
        }

        prefix = prompt_prefixes.get(agent_id, f"You are the {agent_id.replace('_', ' ').title()} agent. Your role: {role}.\n\n")
        return prefix + f"USER REQUEST: {user_input}\n\n" + self._get_permission_context(agent_id)

    def _get_permission_context(self, agent_id: str) -> str:
        term = self._tm.get_terminal(agent_id)
        if not term:
            return ""
        sandbox = term.sandbox_dir
        perms = term.file_permissions
        granted = term.granted_paths

        ctx = f"YOUR SANDBOX: {sandbox}\n"
        ctx += f"FILE ACCESS: sandbox directory ({', '.join(perms)})" if perms else "FILE ACCESS: sandbox directory only"
        if granted:
            ctx += f"\nGRANTED PATHS: {', '.join(granted)}"
        ctx += "\n\n"
        return ctx

    def get_terminal_output(self, agent_id: str, lines: int = 50) -> list[str]:
        return self._tm.get_buffer(agent_id, lines)

    def get_history(self, limit: int = 20) -> list[dict]:
        return self._history[-limit:]

    def get_status(self) -> dict[str, Any]:
        statuses = self._tm.get_all_statuses()
        return {
            "terminals": statuses,
            "running": sum(1 for s in statuses.values() if s == "running"),
            "stopped": sum(1 for s in statuses.values() if s == "stopped"),
            "tasks_processed": len(self._history),
        }
