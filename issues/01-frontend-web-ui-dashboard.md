---
title: "[Core] Build Frontend Web UI — Agent Control Dashboard"
labels: ["enhancement", "frontend", "core"]
assignees: []
---

## Description
Chakravyuh AI currently has no frontend UI. The entire system is accessed through the backend API. We need a modern, dark-theme web dashboard that serves as the command center for the entire AI operating system.

## Requirements

### Agent Control Panel
- Live view of all 10 agents (Coordinator, Planner, Coder, Researcher, Browser, QA, Memory, Security, GitHub, Deployment)
- Start / Stop / Restart individual agents
- View agent status (Idle, Active, Processing, Waiting, Sleeping, Error)
- Assign agents to specific projects
- Drag-and-drop agent-to-project assignment

### Project Management
- Create and manage multiple concurrent projects
- Show which agents are working on which project
- Agent allocation: 5 agents per project max, with automatic rebalancing
- View project status and progress

### Free Agent Pool
- Show available free agents (OpenCode free tier, Ollama local, OpenRouter free models)
- One-click agent swap between projects
- Show free tier limits and usage

### Live Monitoring
- Real-time agent activity feed
- Task execution logs per agent
- Memory usage and token consumption
- Error alerts and notifications

### Tech Stack
- Framework: React / Next.js or Vue 3
- Styling: Dark theme, modern glassmorphism/neumorphism
- Real-time: WebSocket connection to backend
- API integration with existing `/api/v1/*` endpoints

## Acceptance Criteria
- [ ] Dashboard loads and shows all 10 agents with live status
- [ ] User can assign agents to projects
- [ ] Free agent pool shows available models
- [ ] Real-time logs stream via WebSocket
- [ ] Dark theme is consistent and polished
- [ ] Responsive design works on desktop and tablet

## Additional Context
This is the highest priority feature after the backend stabilizes. The existing `index.html` is a marketing landing page — the dashboard should be a new SPA in `frontend/` directory.
