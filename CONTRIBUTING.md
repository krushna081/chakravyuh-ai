# Contributing

## Workflow

```
feature/* → test → dev → main
```

| Branch | Purpose | Protected |
|--------|---------|-----------|
| `main` | Production-ready | ✅ PR + review |
| `dev` | Integration | ✅ CI must pass |
| `test` | Feature verification | ❌ |
| `feature/*` | Development | ❌ |
| `fix/*` | Bug fixes | ❌ |
| `docs/*` | Documentation | ❌ |

## Steps

```bash
git checkout test
git pull upstream test
git checkout -b feature/my-feature
# make changes
git commit -m "feat(scope): description"
git push origin feature/my-feature
# open PR → test
```

## Commit Convention

```
<type>(<scope>): <description>
```

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation |
| `refactor` | Code restructuring |
| `perf` | Performance |
| `test` | Tests |
| `chore` | Build, deps |
| `ci` | CI config |

## Before Requesting Review

- [ ] `npm test` passes
- [ ] `npm run lint` clean
- [ ] `npm run typecheck` clean
- [ ] Tests added for new code
- [ ] Docs updated if needed

## Standards

- **Language**: TypeScript (strict mode)
- **Formatting**: Prettier, 100 char width, 2-space indent
- **Naming**: PascalCase (classes/interfaces), camelCase (functions/vars), kebab-case (files)
- **Imports**: Built-in → external → internal → relative
- **No default exports** — prefer named exports

## Testing

```bash
npm test             # all tests
npm run test:watch   # watch mode
npm run test:coverage # with coverage
```

## Reporting Issues

**Bugs**: Steps to reproduce, expected vs actual, environment, logs.  
**Features**: Problem, desired solution, alternatives, context.
