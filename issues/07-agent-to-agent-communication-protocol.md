---
title: "[Core] Inter-Agent Communication Protocol Enhancement"
labels: ["enhancement", "core", "agents"]
assignees: []
---

## Description
Agents currently communicate through the event bus, but the protocol is minimal. We need a robust inter-agent communication protocol with:
- Structured message envelopes with routing info
- Request/Response correlation
- Scatter-Gather pattern support
- Pipeline/Chain pattern support
- Message priority and TTL
- Message delivery guarantees

## Requirements

### Message Envelope
```typescript
interface AgentMessage {
  id: string
  from: string
  to: string | string[] | 'broadcast'
  type: 'request' | 'response' | 'broadcast' | 'error' | 'scatter' | 'gather'
  priority: 'low' | 'medium' | 'high' | 'critical'
  payload: {
    task?: string
    data?: unknown
    context?: Record<string, unknown>
    expectResponse?: boolean
  }
  metadata: {
    timestamp: string
    ttl: number
    traceId: string
    parentId?: string
    correlationId?: string
    hopCount: number
  }
}
```

### Communication Patterns
1. **Request-Response**: Direct 1:1 with correlationId
2. **Broadcast**: One agent → all peers
3. **Scatter-Gather**: Coordinator fans out → multiple agents → collects results
4. **Pipeline**: Agent1 → Agent2 → Agent3 (sequential processing)
5. **Debate**: Multiple agents argue positions → mediator judges

### Delivery Guarantees
- At-least-once delivery with acknowledgments
- Dead letter queue for undeliverable messages
- Message TTL with automatic expiry
- Rate limiting per agent (max messages/minute)

### Dashboard Visibility
- Message flow visualization
- Active conversations between agents
- Message queue depth per agent
- Failed/delayed message alerts

## Acceptance Criteria
- [ ] All 5 communication patterns are implemented
- [ ] Request/Response correlation works correctly
- [ ] Scatter-Gather collects and merges results
- [ ] Pipeline passes context between agents
- [ ] Dead letter queue captures undelivered messages
- [ ] Dashboard shows agent communication graph
- [ ] Unit tests for each pattern

## Additional Context
This protocol is what makes multi-agent collaboration possible. Without it, agents are isolated workers rather than a coordinated mesh.
