---
title: "[Provider] Free Agent Tier — Ollama, OpenCode, OpenRouter Free Models"
labels: ["enhancement", "provider", "free-tier"]
assignees: []
---

## Description
Not all users have paid API keys. We need a "free agent tier" that works with:
1. **Ollama** — Fully local, free, private inference (Llama 3, Mistral, Phi-3, etc.)
2. **OpenCode** — Free tier for code generation and assistance
3. **OpenRouter Free Models** — Community models with free tier limits
4. **HuggingFace Inference API** — Free tier with rate limits

## Requirements

### Free Agent Pool Manager
- Detect available free providers at startup
- Track rate limits and usage quotas per provider
- Rotate between free providers when rate limits are hit
- Fall back gracefully: paid → free tier → error message

### Ollama Integration (already exists as stub)
```yaml
agents:
  coder:
    provider: strategy
    strategy:
      type: fallback
      prefer: [openai, anthropic]
      fallback: [ollama, opencode-free]
      freeTierOnly: false  # if true, only use free providers
```

### UI Indicator
- Dashboard shows which agents are on "Free Tier" vs "Pro Tier"
- Token usage counter for free tier limits
- "Switch to Free" button per agent
- Estimated cost savings display

### Rate Limit Handling
- Ollama: no limits (local)
- OpenCode Free: 100 requests/day
- OpenRouter Free: 20 requests/min, 200/day
- Queue requests when limits are hit
- Notify user when approaching limits

## Acceptance Criteria
- [ ] Ollama provider works with at least 3 models (llama3, mistral, phi3)
- [ ] OpenCode free tier integration works
- [ ] OpenRouter free model routing works
- [ ] Automatic fallback between free providers
- [ ] Rate limits are tracked and respected
- [ ] Dashboard shows free/pro status per agent
- [ ] Users can run entire projects with $0 cost

## Additional Context
This makes Chakravyuh AI accessible to everyone, not just users with paid API keys. Local-first AI is critical for privacy-sensitive users.
