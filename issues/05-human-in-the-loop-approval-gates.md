---
title: "[Security] Human-in-the-Loop Approval Gates"
labels: ["enhancement", "security", "workflow"]
assignees: []
---

## Description
Autonomous agents should not perform dangerous operations without human approval. We need a configurable approval gate system that pauses workflows and waits for human sign-off before proceeding.

## Requirements

### Approval Gate Types
```typescript
type ApprovalGate = 
  | { type: 'human_approval'; message: string; timeout: number }
  | { type: 'condition'; expression: string }
  | { type: 'code_review'; threshold: 'patch' | 'minor' | 'major' }
  | { type: 'cost_check'; maxTokens: number; maxCost: number }
```

### Workflow Integration
```yaml
steps:
  - id: deploy
    agent: deployment
    task: "Deploy to production"
    gates:
      - type: human_approval
        message: "Deploy v2.1 to production?"
        timeout: 3600000  # 1 hour
      - type: cost_check
        maxTokens: 50000
```

### API Endpoints
- `GET /api/v1/gates` — List pending approval requests
- `POST /api/v1/gates/:id/approve` — Approve a gate
- `POST /api/v1/gates/:id/reject` — Reject with reason
- `GET /api/v1/gates/:id` — Get gate details

### Notification System
- Dashboard shows pending approvals with count badge
- Color-coded: green (approved), yellow (pending), red (rejected/timed out)
- Click to expand: show context, task details, cost estimate
- Timeout auto-rejects with configurable duration

## Acceptance Criteria
- [ ] Human approval gates pause workflow execution
- [ ] Approval/rejection via API and dashboard
- [ ] Timeout mechanism for stale gates
- [ ] Audit log of all approval decisions
- [ ] Dashboard shows pending approvals prominently
- [ ] Email/webhook notification for new approvals

## Additional Context
This is critical for production deployments, code reviews, and any operation that modifies external systems.
