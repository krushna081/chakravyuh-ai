---
title: "[Core] Comprehensive Error Handling & Circuit Breaker"
labels: ["enhancement", "core", "reliability"]
assignees: []
---

## Description
The system needs robust error handling at every layer with circuit breaker patterns to prevent cascading failures.

## Requirements

### Error Categories
```typescript
class ProviderError extends Error {
  category: 'rate_limit' | 'timeout' | 'auth' | 'model_unavailable' | 'bad_request'
  provider: string
  retryable: boolean
  estimatedRetryAfterMs?: number
}

class AgentError extends Error {
  category: 'timeout' | 'tool_failure' | 'memory_full' | 'invalid_message'
  agentId: string
}

class MCPError extends Error {
  category: 'connection' | 'timeout' | 'tool_not_found' | 'invalid_args'
  serverId: string
}
```

### Circuit Breaker (per provider)
```
States: CLOSED (normal) → OPEN (failing) → HALF_OPEN (testing) → CLOSED
- Track error rate in sliding window (last 5 min)
- Open circuit when error rate > 50%
- Half-open after 30s cooldown
- Close after 3 successful requests
```

### Fallback Chain
```yaml
providers:
  openai:
    circuitBreaker:
      errorThreshold: 0.5
      cooldownMs: 30000
      halfOpenMaxRequests: 3
    fallback: [anthropic, google]
```

### Dashboard Alerts
- Circuit breaker state per provider (green/yellow/red)
- Error rate chart (last 1h)
- Recent errors feed with expandable details
- "Retry Now" button for failed tasks
- Alert when circuit opens/closes

## Acceptance Criteria
- [ ] All errors have typed categories and metadata
- [ ] Circuit breaker opens on high error rate
- [ ] Fallback chain activates when circuit is open
- [ ] Auto-recovery after cooldown period
- [ ] Dashboard shows circuit states and error rates
- [ ] Rate limit handling with exponential backoff
- [ ] No cascading failures (one failing provider doesn't crash system)

## Additional Context
Reliability is essential for an AI OS. Without circuit breakers, a single provider outage could block all tasks.
