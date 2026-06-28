---
title: "[Agents] Extended Agent Types — Data Analyst, DevOps, Comms, Learning"
labels: ["enhancement", "agents", "new-agent"]
assignees: []
---

## Description
The roadmap mentions 4 additional agent types. We need to design and implement them:

### 1. Data Analyst Agent
- Database queries, chart generation, NL-to-SQL
- Tools: Database MCP, FileSystem, Web Fetch
- Provider: Gemini (1M context for large datasets)
- Priority: v0.3

### 2. DevOps Agent
- Terraform, Kubernetes, CI/CD, monitoring
- Tools: Terminal, GitHub, FileSystem, Docker MCP
- Provider: Claude Sonnet (strong tool use)
- Priority: v0.3

### 3. Communications Agent
- Email, calendar, meeting notes, translation
- Tools: Gmail MCP, Calendar MCP, Drive MCP
- Provider: GPT-4o mini (cost effective for text)
- Priority: v0.4

### 4. Learning Agent
- Study plans, flashcards, progress tracking
- Tools: Memory (all tiers), Web Fetch
- Provider: Cheapest capable
- Priority: v0.4

### Implementation Requirements
Each agent needs:
- Agent definition in `agents/<name>/index.ts`
- System prompt in `prompts/<name>.md`
- Configuration in `config/agents.yaml`
- YAML config entry with provider, model, tools, memory scope, limits
- Unit tests for message handling
- Integration test with coordinator

## Acceptance Criteria
- [ ] All 4 new agents have working implementations
- [ ] Each agent has a system prompt
- [ ] Agents appear in the dashboard and API
- [ ] Coordinator can route tasks to new agents
- [ ] Agents have appropriate tool access and limits
- [ ] Unit tests pass for each agent
- [ ] Documentation updated with new agent details

## Additional Context
These agents expand Chakravyuh's capabilities from pure development to business operations and education.
