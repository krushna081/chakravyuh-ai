# Chakravyuh AI — All GitHub Issues

Below is the complete list of pre-written issues you can upload to the GitHub Issues section of your repository.

---

## Core System

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 01 | [Build Frontend Web UI — Agent Control Dashboard](./01-frontend-web-ui-dashboard.md) | `enhancement`, `frontend`, `core` | 🔴 High |
| 02 | [Multi-Project Agent Scheduler & Load Balancer](./02-multi-project-agent-scheduler.md) | `enhancement`, `core`, `orchestrator` | 🔴 High |
| 07 | [Inter-Agent Communication Protocol Enhancement](./07-agent-to-agent-communication-protocol.md) | `enhancement`, `core`, `agents` | 🔴 High |
| 09 | [Task Analyzer & Capability Router Implementation](./09-task-analyzer-and-capability-router.md) | `enhancement`, `core`, `orchestrator` | 🔴 High |
| 10 | [Comprehensive Error Handling & Circuit Breaker](./10-error-handling-and-circuit-breaker.md) | `enhancement`, `core`, `reliability` | 🔴 High |

## Providers & Free Tier

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 03 | [Free Agent Tier — Ollama, OpenCode, OpenRouter Free Models](./03-free-agent-integration-ollama-opencode.md) | `enhancement`, `provider`, `free-tier` | 🔴 High |

## Real-Time & Monitoring

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 04 | [Real-Time Agent Monitoring via WebSocket](./04-real-time-agent-monitoring-websocket.md) | `enhancement`, `api`, `real-time` | 🔴 High |

## Security

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 05 | [Human-in-the-Loop Approval Gates](./05-human-in-the-loop-approval-gates.md) | `enhancement`, `security`, `workflow` | 🟡 Medium |
| 11 | [Prompt Injection Detection & Security Audit System](./11-security-audit-and-injection-detection.md) | `enhancement`, `security`, `core` | 🔴 High |

## Memory

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 06 | [Complete Memory Driver Implementations](./06-agent-memory-persistence.md) | `enhancement`, `memory`, `core` | 🟡 Medium |

## DevOps & Deployment

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 08 | [Docker Compose & Production Deployment](./08-docker-compose-deployment.md) | `enhancement`, `devops`, `infrastructure` | 🟡 Medium |

## Developer Experience

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 12 | [CLI Command-Line Interface Tool](./12-cli-command-line-tool.md) | `enhancement`, `cli`, `developer-experience` | 🟡 Medium |
| 15 | [Workflow Visual Editor — Drag & Drop Pipeline Builder](./15-workflow-visual-editor.md) | `enhancement`, `frontend`, `workflow` | 🟢 Low |

## Testing

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 13 | [Performance Benchmarking & Load Testing](./13-performance-benchmarking.md) | `testing`, `performance`, `infrastructure` | 🟡 Medium |

## New Agent Types

| # | Title | Labels | Priority |
|---|-------|--------|----------|
| 14 | [Extended Agent Types — Data Analyst, DevOps, Comms, Learning](./14-extended-agent-types.md) | `enhancement`, `agents`, `new-agent` | 🟢 Low |

---

## How to Upload

1. Go to your GitHub repository: `https://github.com/krushna081/chakravyuh-ai/issues`
2. Click **"New issue"**
3. For each issue file:
   - Copy the title from the `title:` field
   - Copy the body (everything after `---`)
   - Apply the labels listed
4. Or use GitHub CLI:
   ```bash
   gh issue create --title "..." --body "$(cat issues/01-frontend-web-ui-dashboard.md)" --label "enhancement,frontend,core"
   ```

## Issue Templates (`.github/ISSUE_TEMPLATE/`)

The following templates are already configured in the repository:

| Template | File | Purpose |
|----------|------|---------|
| Bug Report | `01_bug_report.yml` | Report reproducible bugs |
| Feature Request | `02_feature_request.yml` | Suggest new features |
| RFC | `03_rfc.yml` | Propose architectural changes |
| New Agent | `05_new_agent.yml` | Propose new specialized agents |
| New Provider | `06_new_provider.yml` | Request new AI provider |
| New MCP Server | `07_new_mcp_server.yml` | Propose new MCP servers |
| Performance Issue | `08_performance_issue.yml` | Report performance problems |
