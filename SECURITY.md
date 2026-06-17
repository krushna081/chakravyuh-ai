# Security

## Reporting

**Do not** open public issues. Report privately:

- **Email**: security@chakravyuh.dev
- **GitHub**: [Security Advisory](https://github.com/anomalyco/chakravyuh-ai/security/advisories/new)

### Response

| Time | Action |
|------|--------|
| 24h | Acknowledgment |
| 7d | Assessment |
| 30d | Critical/high patch |
| 90d | Medium/low patch |

## Best Practices

### API Keys
- Never commit keys — use `.env`
- Rotate regularly
- Use read-only keys where possible

```bash
# .env — DO NOT COMMIT
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
DEEPSEEK_API_KEY=...
```

### Network
- Run MCP servers on localhost (default)
- Use TLS for remote deployments
- Network segmentation for multi-agent

### Agent Permissions
- Capability-based tool access
- Audit log all agent actions
- Human-in-the-loop for destructive ops
- Token budgets and timeouts

## Built-in Security

| Feature | Description |
|---------|-------------|
| Prompt injection detection | Guards against injection attacks |
| Rate limiting | Per-provider, per-agent limits |
| Audit logging | All actions traceable |
| Approval gates | Manual approval for sensitive ops |
| Sandboxed execution | Isolated agent contexts |
| Input validation | Strict schema validation |
| Secrets redaction | Keys redacted from logs |

## Dependencies

Automated scanning via Dependabot, Snyk, and npm audit.
