---
title: "[DevOps] Docker Compose & Production Deployment"
labels: ["enhancement", "devops", "infrastructure"]
assignees: []
---

## Description
Chakravyuh AI needs a complete Docker-based deployment setup for both development and production. This includes:

## Requirements

### Docker Compose (Development)
```yaml
services:
  app:
    build: .
    ports: ["3000:3000"]
    volumes: [".:/app", "/app/node_modules"]
    env_file: .env
    depends_on: [redis, qdrant]
  
  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
  
  qdrant:
    image: qdrant/qdrant
    ports: ["6333:6333"]
  
  postgres:
    image: postgres:16-alpine
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
```

### Dockerfile
- Multi-stage build (dev → build → production)
- Stage 1: Install deps + build
- Stage 2: Production image with compiled JS only
- Non-root user for security
- Health check endpoint

### Production Deployment
- Docker Compose with resource limits
- Environment-specific config (dev/staging/prod)
- Logging to stdout with JSON format
- Graceful shutdown handling
- Readiness and liveness probes
- Optional: Kubernetes manifests

### CI/CD Integration
- GitHub Actions: Build and push Docker image
- Tag images with git sha and semantic version
- Automatic deployment to staging on dev branch
- Manual deployment to production via workflow_dispatch

## Acceptance Criteria
- [ ] `docker compose up` starts the entire stack
- [ ] Multi-stage Dockerfile produces <200MB production image
- [ ] Health check endpoint returns 200
- [ ] Graceful shutdown completes within 30s
- [ ] CI pipeline builds and pushes Docker images
- [ ] Documentation for deployment

## Additional Context
Currently there's no Docker setup, making it hard for new contributors to get started.
