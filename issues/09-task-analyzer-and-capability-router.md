---
title: "[Core] Task Analyzer & Capability Router Implementation"
labels: ["enhancement", "core", "orchestrator"]
assignees: []
---

## Description
The Task Analyzer and Capability Router are defined in ARCHITECTURE.md but not fully implemented. These components are critical for intelligent task routing:

### Task Analyzer
Classifies incoming requests to determine:
- Task type: code | research | browse | plan | test | memory | security | deploy
- Complexity: simple | moderate | complex
- Required capabilities: chat | code | vision | reasoning | audio
- Estimated token usage
- Sensitivity level
- Timeout requirement

### Capability Router
Selects the optimal provider and model based on:
- Task requirements (from Task Analyzer)
- Provider capabilities (from providers.yaml)
- Cost optimization
- Latency requirements
- Availability and health

### Routing Strategies
```typescript
type RoutingStrategy = 
  | { type: 'fixed'; provider: string; model: string }
  | { type: 'fallback'; primary: string; chain: string[] }
  | { type: 'capability'; minCapability: string; prefer: string[] }
  | { type: 'cheapest'; minCapability?: string }
  | { type: 'fastest'; minCapability?: string }
  | { type: 'ensemble'; providers: string[]; aggregation: 'majority' | 'average' }
  | { type: 'cost-aware'; budget: number; maxTokens: number }
```

### Dashboard Integration
- Show routing decisions for each task
- Display why a specific provider/model was chosen
- Allow manual override of routing decisions
- Show cost estimates before execution

## Acceptance Criteria
- [ ] Task Analyzer correctly classifies 10+ example tasks
- [ ] Capability Router selects optimal provider based on strategy
- [ ] Fallback chain works when primary provider fails
- [ ] Cost-aware routing respects budget constraints
- [ ] Dashboard shows routing decisions with explanations
- [ ] Manual override of routing works
- [ ] Unit tests for all 7 routing strategies

## Additional Context
This is the "brain" that decides which agent + provider handles each task. It's the key differentiator from simple single-provider systems.
