---
title: "[API] Real-Time Agent Monitoring via WebSocket"
labels: ["enhancement", "api", "real-time"]
assignees: []
---

## Description
The current API is request-response only. We need WebSocket support for real-time streaming of:
- Agent state changes (Idle → Active → Processing → Waiting → etc.)
- Task execution logs per agent
- LLM token streaming
- Memory operations
- Error alerts

## Requirements

### WebSocket Endpoint
```
ws://localhost:3000/api/v1/ws
```

### Event Types
```typescript
interface WsEvent {
  type: 'agent.state' | 'agent.log' | 'task.progress' | 'token.stream' 
        | 'memory.op' | 'error.alert' | 'project.update'
  payload: Record<string, unknown>
  timestamp: string
}
```

### Agent State Events
```json
{
  "type": "agent.state",
  "payload": {
    "agentId": "coder",
    "projectId": "proj-1",
    "fromState": "Idle",
    "toState": "Processing",
    "taskId": "task-123"
  }
}
```

### Token Streaming
- Stream LLM tokens in real-time to the frontend
- Each token event includes: agentId, taskId, tokens (chunk), totalTokens

### Dashboard Integration
- Frontend connects to WebSocket on load
- Auto-reconnect with exponential backoff
- Event buffer for offline periods
- Filter events by agent, project, or event type

## Acceptance Criteria
- [ ] WebSocket server starts and accepts connections
- [ ] All agent state changes are broadcast
- [ ] Token streaming works for all providers
- [ ] Auto-reconnect works with backoff
- [ ] Frontend dashboard shows live agent activity
- [ ] At most 2s delay between event and display
- [ ] Unit tests for WebSocket event system

## Additional Context
This powers the live dashboard. Without WebSocket, the UI would need constant polling which is inefficient.
