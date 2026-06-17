# Contributing to Chakravyuh AI

---

## Workflow

```
feature/* → test → dev → main
```

### Branch Strategy

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production-ready releases | ✅ PR + review required |
| `dev` | Integration branch | ✅ CI must pass |
| `test` | Feature verification | ❌ |
| `feature/*` | New feature development | ❌ |
| `fix/*` | Bug fixes | ❌ |
| `docs/*` | Documentation changes | ❌ |
| `refactor/*` | Code restructuring | ❌ |
| `perf/*` | Performance improvements | ❌ |

### Development Flow

```bash
# 1. Start from the latest test branch
git checkout test
git pull upstream test

# 2. Create your feature branch
git checkout -b feature/my-feature

# 3. Make your changes
#    - Follow coding standards (see below)
#    - Write tests for new code
#    - Update documentation if needed

# 4. Commit your changes (Conventional Commits)
git commit -m "feat(scope): description"

# 5. Push and open a PR
git push origin feature/my-feature
# Open PR: feature/* → test
```

---

## Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Usage | Example |
|------|-------|---------|
| `feat` | New feature | `feat(providers): add Grok provider` |
| `fix` | Bug fix | `fix(router): handle empty message queue` |
| `docs` | Documentation | `docs(architecture): update data flow diagram` |
| `refactor` | Code restructuring | `refactor(memory): extract base store class` |
| `perf` | Performance | `perf(router): optimize message dispatch` |
| `test` | Tests | `test(providers): add OpenAI streaming tests` |
| `chore` | Build, deps, tooling | `chore(deps): update zod to 3.23` |
| `ci` | CI config | `ci: add security audit step` |

### Scopes

`orchestrator`, `router`, `scheduler`, `registry`, `providers`, `memory`, `mcp`, `api`, `cli`, `agents`, `config`, `docs`, `ci`, `deps`

---

## Coding Standards

### Language & Runtime

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js 18+ (20 LTS recommended)
- **Package manager**: npm

### Formatting

| Rule | Value |
|------|-------|
| Formatter | Prettier |
| Line width | 100 characters |
| Indentation | 2 spaces |
| Quotes | Single |
| Semicolons | Required |
| Trailing commas | All |

### Naming Conventions

| Construct | Convention | Example |
|-----------|-----------|---------|
| Classes / Interfaces | PascalCase | `class AgentRegistry` |
| Functions / Methods | camelCase | `function dispatchMessage()` |
| Variables | camelCase | `const agentConfig` |
| Files | kebab-case | `agent-registry.ts` |
| Constants | UPPER_SNAKE | `const MAX_RETRIES = 3` |
| Types / Interfaces | PascalCase with `I` prefix optional | `AgentConfig` |

### Imports Order

```typescript
// 1. Built-in modules
import { EventEmitter } from 'node:events'

// 2. External dependencies
import { z } from 'zod'

// 3. Internal aliases
import { Router } from '@chakravyuh/core'

// 4. Relative imports
import { AgentBase } from './base.js'
```

### Rules

- **No default exports** — prefer named exports
- **No `any` type** — use `unknown` and narrow with type guards
- **Async/await** over raw promises
- **Zod** for all runtime validation
- **JSDoc** for all public API surfaces
- **Error handling** — always handle or propagate errors explicitly

---

## Testing

```bash
npm test               # Run all tests
npm run test:watch     # Watch mode
npm run test:coverage  # With coverage report
```

### Requirements

- Unit tests for all new code
- Integration tests for providers and MCP servers
- E2E tests for workflows (where applicable)
- Minimum 80% coverage for new code

---

## Pull Request Process

### Before Requesting Review

- [ ] `npm test` passes
- [ ] `npm run lint` is clean
- [ ] `npm run typecheck` is clean
- [ ] Tests added for new code
- [ ] Documentation updated if needed
- [ ] Changelog entry added
- [ ] Branch is up to date with `test`

### Review Process

1. **Automated checks** — CI must pass
2. **Code review** — At least one maintainer approval
3. **Merge** — Squash merge into `test`

---

## Reporting Issues

### Bugs

When reporting a bug, include:
- Steps to reproduce
- Expected vs actual behavior
- Environment (OS, Node version, Docker version)
- Configuration (redact API keys)
- Logs or error messages

### Feature Requests

When requesting a feature, include:
- Problem statement and use case
- Proposed solution
- Alternatives considered
- Any relevant context or examples

---

## Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/chakravyuh-ai.git
cd chakravyuh-ai

# Add upstream
git remote add upstream https://github.com/anomalyco/chakravyuh-ai.git

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys

# Run in dev mode
npm run dev
```

---

## Code of Conduct

All contributors must follow our [Code of Conduct](docs/CODE_OF_CONDUCT.md). Please be respectful, inclusive, and constructive in all interactions.

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache 2.0 License](LICENSE).
