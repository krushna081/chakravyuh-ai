---
title: "[Core] Multi-Project Agent Scheduler & Load Balancer"
labels: ["enhancement", "core", "orchestrator"]
assignees: []
---

## Description
The current system routes tasks to agents but has no concept of "projects" or load-balanced agent allocation across multiple simultaneous projects. We need a scheduler that:
- Groups tasks into projects
- Allocates agents to projects (up to 5 agents per project)
- Automatically rebalances agents when projects start/finish
- Queues tasks when all agents are busy

## Requirements

### Project Registry
- Create/read/update/delete projects
- Each project has: id, name, description, priority, status, assigned agents
- API endpoints: `GET/POST/PUT/DELETE /api/v1/projects`

### Agent Allocation Algorithm
- `maxAgentsPerProject = 5` (configurable)
- When project starts: allocate available agents from the free pool
- When project ends: release agents back to free pool
- Priority-based scheduling: higher priority projects get agents first
- Fairness: no single project can monopolize all agents

### Example Flow
```
Project A (P1, 5 agents) → [Coder, Researcher, Browser, QA, GitHub]
Project B (P2, 3 agents) → [Coordinator, Planner, Memory]  
Free Pool → [Security, Deployment]
→ Project A finishes → all 5 agents return to pool
→ Project B can now scale up
```

### Configuration
```yaml
scheduler:
  maxAgentsPerProject: 5
  maxConcurrentProjects: 10
  rebalanceIntervalMs: 30000
  strategy: "fair-share"  # | "priority" | "first-come"
```

## Acceptance Criteria
- [ ] Can create/delete/manage projects via API
- [ ] Agents auto-assign to projects based on availability
- [ ] Rebalancing works when projects start/finish
- [ ] Priority queue for high-priority projects
- [ ] All 10 agents are distributable across projects
- [ ] Unit tests for allocation algorithm

## Additional Context
This is essential for the multi-tenant use case where different users/projects run concurrently.
