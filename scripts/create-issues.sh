#!/usr/bin/env bash
# Chakravyuh AI — GitHub Issue Creator
# Run: bash scripts/create-issues.sh
# Requires: gh CLI installed and authenticated (gh auth login)

REPO="krushna081/chakravyuh-ai"

echo "⚔️  Creating 18 GitHub Issues for Chakravyuh AI..."
echo ""

# ── Issue 1 ───────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Core] Implement Config Manager with Hot-Reload Support" --label "enhancement" --body '
## Description

The ConfigManager in `backend/src/config/loader.ts` needs to be completed with full hot-reload support.

## Tasks
- [ ] Implement file watcher for YAML config changes
- [ ] Add Zod schema validation for all config types
- [ ] Create typed config interfaces for providers, agents, and MCP
- [ ] Add config caching with invalidation
- [ ] Write unit tests for config loading

## Priority
High — Blocks all other components
'

# ── Issue 2 ───────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Core] Complete Memory Manager with Write-Through Cache" --label "enhancement" --body '
## Description

The MemoryManager in `backend/src/memory/manager.ts` needs a fully working write-through cache implementation.

## Tasks
- [ ] Implement write-through caching strategy
- [ ] Add memory tier selection logic
- [ ] Implement memory consolidation across tiers
- [ ] Add TTL-based pruning
- [ ] Create integration tests for multi-tier storage

## Priority
High — Required for agent context persistence
'

# ── Issue 3 ───────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Providers] Add Streaming Support for All 7 LLM Providers" --label "bug" --body '
## Description

Several provider implementations have partial or missing streaming support. Need to ensure all providers properly implement `AsyncIterable<CompletionChunk>`.

## Providers to fix
- [ ] OpenAI — verify SSE streaming
- [ ] Anthropic — verify event-based streaming
- [ ] Google Gemini — verify SSE streaming
- [ ] DeepSeek — add streaming if missing
- [ ] Grok — add streaming if missing
- [ ] OpenRouter — add streaming if missing
- [ ] Ollama — verify NDJSON streaming

## Acceptance Criteria
Each provider should produce properly typed CompletionChunk objects with correct finishReason.
'

# ── Issue 4 ───────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Agents] Implement Inter-Agent Communication Protocol" --label "enhancement" --body '
## Description

Agents need a robust communication protocol using the AgentMessage interface. Currently agents have basic message handling.

## Tasks
- [ ] Implement message serialization/deserialization
- [ ] Add message retry with exponential backoff
- [ ] Implement priority queue for critical messages
- [ ] Add message tracing (traceId propagation)
- [ ] Create communication contracts between agent pairs
- [ ] Write tests for scatter-gather pattern

## Priority
Medium — Needed for multi-agent workflows
'

# ── Issue 5 ───────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[MCP] Implement Browser Automation Server" --label "enhancement" --body '
## Description

The Browser MCP server in `mcp/servers/browser/index.ts` needs a real headless browser integration.

## Tasks
- [ ] Integrate with Playwright or Puppeteer
- [ ] Implement all tools: navigate, click, type, screenshot, scroll
- [ ] Add session management with cookie persistence
- [ ] Implement page wait strategies (waitForSelector, waitForNavigation)
- [ ] Add screenshot diffing for visual regression
- [ ] Write browser-specific tests

## Priority
Medium — Required for Browser agent
'

# ── Issue 6 ───────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Security] Implement Rate Limiting and Token Bucket" --label "enhancement" --body '
## Description

The security layer needs rate limiting to prevent abuse. Current implementation has only auth and audit.

## Tasks
- [ ] Implement token bucket algorithm
- [ ] Add per-agent rate limits (from config)
- [ ] Add global rate limits (from env)
- [ ] Implement rate limit headers in API responses
- [ ] Add rate limit bypass for critical messages
- [ ] Write rate limit tests

## Priority
High — Required for production deployment
'

# ── Issue 7 ───────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Core] Implement Workflow Scheduler with DAG Execution" --label "enhancement" --body '
## Description

The workflow scheduler in `backend/src/scheduler/` needs full DAG-based execution with parallel step support.

## Tasks
- [ ] Implement topological sort for dependency resolution
- [ ] Add parallel step execution with Promise.all
- [ ] Implement gate conditions (conditional branching)
- [ ] Add human-in-the-loop approval gates
- [ ] Implement retry policies and onFailure handlers
- [ ] Write comprehensive workflow tests

## Priority
Medium — Required for autonomous workflows
'

# ── Issue 8 ───────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Providers] Add Embedding Support for Vector Memory" --label "enhancement" --body '
## Description

The LLM provider interface has an `embed?()` method, but most providers do not implement it yet.

## Tasks
- [ ] Implement `embed()` in OpenAI provider
- [ ] Implement `embed()` in Google Gemini provider
- [ ] Add embedding model configuration to providers.yaml
- [ ] Create embedding cache to avoid redundant API calls
- [ ] Integrate embeddings with Vector memory driver

## Priority
Medium — Required for semantic memory search
'

# ── Issue 9 ───────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Memory] Implement Redis Driver with ioredis" --label "enhancement" --body '
## Description

The Redis working memory driver uses an in-memory Map placeholder. Need to replace with actual Redis via ioredis.

## Tasks
- [ ] Add ioredis as dependency for @chakravyuh/memory-redis
- [ ] Implement connection pooling
- [ ] Add Redis TTL commands for auto-expiry
- [ ] Implement atomic operations for concurrent access
- [ ] Add Redis cluster support for production
- [ ] Write Redis-specific integration tests

## Priority
Medium — Working memory needs persistence
'

# ── Issue 10 ──────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[API] Add WebSocket Support for Streaming Responses" --label "enhancement" --body '
## Description

The API server needs WebSocket support for real-time streaming responses from agents and providers.

## Tasks
- [ ] Implement WebSocket upgrade handler in server.ts
- [ ] Create WS message protocol (subscribe/unsubscribe to agent responses)
- [ ] Support streaming LLM responses through WebSocket
- [ ] Add reconnection handling on client disconnect
- [ ] Write WebSocket integration tests

## Priority
Medium — Required for real-time UX
'

# ── Issue 11 ──────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Tests] Achieve 80%+ Code Coverage" --label "tests" --body '
## Description

Current test coverage is incomplete. Need to increase coverage across all modules.

## Target modules
- [ ] Backend core: orchestrator, router, scheduler (target 90%)
- [ ] Providers: all 7 providers (target 85%)
- [ ] Agents: all 10 agents (target 80%)
- [ ] MCP servers: all 9 servers (target 75%)
- [ ] Security layer: auth, audit, injection (target 90%)
- [ ] Memory: manager + 4 drivers (target 85%)

## Acceptance Criteria
Overall coverage >= 80%, with no module below 70%.
'

# ── Issue 12 ──────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[CI] Set Up GitHub Actions with Multi-Stage Pipeline" --label "enhancement" --body '
## Description

The CI workflow in `.github/workflows/ci.yml` needs a complete multi-stage pipeline.

## Tasks
- [ ] Add TypeScript type-checking stage
- [ ] Add linting stage with ESLint
- [ ] Add unit test stage with vitest
- [ ] Add integration test stage
- [ ] Add coverage reporting
- [ ] Add build verification stage
- [ ] Add security audit (npm audit)
- [ ] Cache node_modules for faster runs

## Priority
High — Enables automated quality checks
'

# ── Issue 13 ──────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Core] Add OpenTelemetry Tracing and Metrics" --label "enhancement" --body '
## Description

Need to add observability via OpenTelemetry for distributed tracing and metrics collection.

## Tasks
- [ ] Add @opentelemetry dependencies
- [ ] Instrument HTTP server with request tracing
- [ ] Add span creation for provider calls
- [ ] Add span creation for agent message routing
- [ ] Implement metrics collection (request count, latency, error rates)
- [ ] Add trace context propagation in AgentMessage metadata
- [ ] Export traces to OTLP endpoint

## Priority
Medium — Required for production monitoring
'

# ── Issue 14 ──────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[MCP] Add OAuth2 Support for Google Services" --label "enhancement" --body '
## Description

The Gmail, Drive, and Calendar MCP servers need OAuth2 authentication flow.

## Tasks
- [ ] Implement OAuth2 authorization URL generation
- [ ] Add token refresh mechanism
- [ ] Create credential storage with encryption
- [ ] Implement Google API token scopes
- [ ] Add interactive auth flow for CLI setup
- [ ] Write OAuth2 integration tests

## Priority
Low — Needed for Google service integration
'

# ── Issue 15 ──────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Core] Implement Agent Task Analyzer with LLM Classification" --label "enhancement" --body '
## Description

The TaskAnalyzer currently uses basic keyword matching. Need to implement LLM-based task classification for better accuracy.

## Tasks
- [ ] Create classification prompt template
- [ ] Implement LLM-based task type detection
- [ ] Add confidence scoring for classifications
- [ ] Implement fallback to keyword matching when LLM unavailable
- [ ] Add custom classification rules support
- [ ] Write accuracy benchmarks

## Priority
Medium — Improves routing accuracy
'

# ── Issue 16 ──────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Security] Add Secrets Redaction from Logs" --label "security" --body '
## Description

The audit logger and general logger need secrets redaction to prevent API keys and tokens from appearing in log files.

## Patterns to redact
- [ ] API keys (sk-..., etc.)
- [ ] JWT tokens
- [ ] Bearer tokens
- [ ] Database URLs with credentials
- [ ] Encryption keys
- [ ] OAuth tokens and refresh tokens

## Tasks
- [ ] Create SecretRedactor utility with regex patterns
- [ ] Integrate with Logger class
- [ ] Integrate with AuditLogger
- [ ] Add configurable redaction patterns
- [ ] Write tests for redaction patterns

## Priority
High — Security-critical
'

# ── Issue 17 ──────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Agents] Implement Coder Agent with Full Git Integration" --label "enhancement" --body '
## Description

The Coder agent needs full git integration for code review, diff generation, and automated PR creation.

## Tasks
- [ ] Implement code diff generation
- [ ] Add PR creation with auto-generated descriptions
- [ ] Implement code review with inline comments
- [ ] Add automated refactoring suggestions
- [ ] Implement multi-file edit support
- [ ] Add test generation alongside code changes

## Priority
Medium — Core agent functionality
'

# ── Issue 18 ──────────────────────────────────────────────────────────────────
gh issue create --repo "$REPO" --title "[Docs] Create API Reference Documentation with TypeDoc" --label "documentation" --body '
## Description

Generate API reference documentation from TypeScript type definitions using TypeDoc.

## Tasks
- [ ] Install and configure TypeDoc
- [ ] Add JSDoc comments to all public APIs
- [ ] Document all exported types and interfaces
- [ ] Generate HTML documentation
- [ ] Add API docs to CI pipeline
- [ ] Create usage examples for each module

## Priority
Medium — Improves developer experience
'

echo ""
echo "✅ All 18 issues created!"
echo "View them at: https://github.com/krushna081/chakravyuh-ai/issues"
