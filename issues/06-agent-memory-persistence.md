---
title: "[Memory] Complete Memory Driver Implementations"
labels: ["enhancement", "memory", "core"]
assignees: []
---

## Description
The memory system has interfaces and stubs defined but no complete, tested implementations. We need fully functional drivers for all four memory tiers:

1. **Working Memory** — Redis driver with TTL-based eviction
2. **Episodic Memory** — SQLite driver with conversation storage and querying
3. **Semantic Memory** — Vector DB driver with embedding generation and similarity search
4. **Procedural Memory** — Filesystem driver with structured markdown storage

## Requirements

### Working Memory (Redis)
- Key-value store with TTL per session
- Session isolation by agent/project
- O(1) read/write
- Fallback to in-memory Map when Redis unavailable

### Episodic Memory (SQLite)
- Schema: conversations, messages, sessions tables
- CRUD operations for conversation history
- Query by agent, project, time range, keywords
- Auto-pruning conversations older than 90 days

### Semantic Memory (Vector DB)
- Interface for pgvector / Qdrant / Pinecone
- Text chunking and embedding generation
- Similarity search with configurable threshold
- Hybrid search: vector + keyword (full-text)

### Procedural Memory (Filesystem)
- Store/retrieve prompts, workflow templates, procedures
- Markdown file format with frontmatter metadata
- Version history via git-like snapshots
- Search by tags, categories, content

### Configuration
```yaml
memory:
  working:
    driver: redis
    redis: { url: "redis://localhost:6379" }
    ttl: 3600  # 1 hour
  episodic:
    driver: sqlite
    sqlite: { path: "./data/episodic.db" }
    retentionDays: 90
  semantic:
    driver: qdrant
    qdrant: { url: "http://localhost:6333", collection: "chakravyuh" }
    embedding: { provider: openai, model: text-embedding-3-small }
  procedural:
    driver: filesystem
    filesystem: { path: "./data/procedures/" }
```

## Acceptance Criteria
- [ ] All 4 memory drivers pass integration tests
- [ ] Fallback mechanism works when primary driver is unavailable
- [ ] Memory operations are observable via dashboard
- [ ] TTL and retention policies are enforced
- [ ] Queries return results in <500ms (working/episodic) and <2s (semantic)
- [ ] Docker compose file includes Redis + Qdrant + SQLite

## Additional Context
Memory is a first-class primitive in Chakravyuh. These drivers are the foundation of all agent state persistence.
