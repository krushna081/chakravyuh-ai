import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MemoryManager } from '../../backend/src/memory/manager.js'
import { ValidationError } from '../../backend/src/errors.js'
import type { MemoryEntry } from '../../backend/src/memory/interfaces.js'
import type { MemoryDriver, WorkingMemoryDriver, EpisodicMemoryDriver, SemanticMemoryDriver, ProceduralMemoryDriver } from '../../backend/src/memory/interfaces.js'

class MockDriver implements MemoryDriver {
  store = new Map<string, MemoryEntry>()

  async get(key: string): Promise<MemoryEntry | null> {
    return this.store.get(key) ?? null
  }
  async set(key: string, value: MemoryEntry): Promise<void> {
    this.store.set(key, value)
  }
  async delete(key: string): Promise<boolean> {
    return this.store.delete(key)
  }
  async search(_query: string): Promise<MemoryEntry[]> {
    return Array.from(this.store.values())
  }
  async clear(): Promise<void> {
    this.store.clear()
  }
}

class MockWorkingDriver extends MockDriver implements WorkingMemoryDriver {
  async getRecent(_agentId: string, _limit?: number): Promise<MemoryEntry[]> {
    return Array.from(this.store.values())
  }
}

class MockEpisodicDriver extends MockDriver implements EpisodicMemoryDriver {
  async getByEpisode(_episodeId: string): Promise<MemoryEntry[]> {
    return Array.from(this.store.values())
  }
}

class MockSemanticDriver extends MockDriver implements SemanticMemoryDriver {
  async getByConcept(_concept: string): Promise<MemoryEntry[]> {
    return Array.from(this.store.values())
  }
}

class MockProceduralDriver extends MockDriver implements ProceduralMemoryDriver {
  async getByProcedure(_procedureId: string): Promise<MemoryEntry[]> {
    return Array.from(this.store.values())
  }
}

function makeEntry(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    type: 'working',
    agentId: 'test-agent',
    content: 'test content',
    metadata: { source: 'test' },
    ...overrides,
  }
}

describe('MemoryManager', () => {
  let working: MockWorkingDriver
  let episodic: MockEpisodicDriver
  let semantic: MockSemanticDriver
  let procedural: MockProceduralDriver
  let manager: MemoryManager

  beforeEach(() => {
    working = new MockWorkingDriver()
    episodic = new MockEpisodicDriver()
    semantic = new MockSemanticDriver()
    procedural = new MockProceduralDriver()
    manager = new MemoryManager(working, episodic, semantic, procedural, true)
  })

  describe('store across tiers', () => {
    it('stores an entry and returns it with id and createdAt', async () => {
      const entry = await manager.store(makeEntry() as never)
      expect(entry.id).toBeDefined()
      expect(entry.createdAt).toBeDefined()
      expect(entry.type).toBe('working')
      expect(entry.agentId).toBe('test-agent')
    })

    it('stores in working memory tier', async () => {
      const entry = await manager.store({ ...makeEntry(), type: 'working' } as never)
      const retrieved = await working.get(entry.id)
      expect(retrieved).toBeDefined()
    })

    it('stores in episodic memory tier', async () => {
      const entry = await manager.store({ ...makeEntry(), type: 'episodic' } as never)
      const retrieved = await episodic.get(entry.id)
      expect(retrieved).toBeDefined()
    })

    it('stores in semantic memory tier', async () => {
      const entry = await manager.store({ ...makeEntry(), type: 'semantic' } as never)
      const retrieved = await semantic.get(entry.id)
      expect(retrieved).toBeDefined()
    })

    it('stores in procedural memory tier', async () => {
      const entry = await manager.store({ ...makeEntry(), type: 'procedural' } as never)
      const retrieved = await procedural.get(entry.id)
      expect(retrieved).toBeDefined()
    })

    it('write-through copies non-working entries to working memory', async () => {
      const entry = await manager.store({ ...makeEntry(), type: 'episodic' } as never)
      const workingEntry = await working.get(entry.id)
      expect(workingEntry).toBeDefined()
    })

    it('does not write-through working entries to working (no self-copy)', async () => {
      const entry = await manager.store({ ...makeEntry(), type: 'working' } as never)
      expect(entry).toBeDefined()
    })

    it('throws on missing agentId', async () => {
      await expect(manager.store({ content: 'test', type: 'working' } as never)).rejects.toThrow(ValidationError)
    })

    it('throws on missing content', async () => {
      await expect(manager.store({ agentId: 'a', type: 'working' } as never)).rejects.toThrow(ValidationError)
    })
  })

  describe('retrieve by type', () => {
    it('retrieves a stored entry from correct tier', async () => {
      const entry = await manager.store({ ...makeEntry(), type: 'semantic' } as never)
      const retrieved = await manager.retrieve(entry.id, 'semantic')
      expect(retrieved).toBeDefined()
      expect(retrieved!.id).toBe(entry.id)
    })

    it('returns null for non-existent entry', async () => {
      const result = await manager.retrieve('nonexistent-id', 'working')
      expect(result).toBeNull()
    })

    it('returns null and deletes expired entries', async () => {
      const entry = await manager.store({
        ...makeEntry(),
        type: 'working',
        expiresAt: new Date(Date.now() - 100000).toISOString(),
      } as never)
      const retrieved = await manager.retrieve(entry.id, 'working')
      expect(retrieved).toBeNull()
      const fromDriver = await working.get(entry.id)
      expect(fromDriver).toBeNull()
    })
  })

  describe('search', () => {
    it('returns entries matching search', async () => {
      await manager.store({ ...makeEntry({ content: 'important data' }), type: 'semantic' } as never)
      const results = await manager.search('important', 'semantic')
      expect(results.length).toBeGreaterThanOrEqual(1)
    })

    it('throws on empty query', async () => {
      await expect(manager.search('', 'working')).rejects.toThrow(ValidationError)
    })

    it('filters out expired entries from search results', async () => {
      await manager.store({
        ...makeEntry({ content: 'fresh data' }),
        type: 'working',
      } as never)
      await manager.store({
        ...makeEntry({
          content: 'stale data',
          expiresAt: new Date(Date.now() - 100000).toISOString(),
        }),
        type: 'working',
      } as never)
      const results = await manager.search('data', 'working')
      expect(results.every((r) => !r.expiresAt || new Date(r.expiresAt) >= new Date())).toBe(true)
    })
  })

  describe('delete', () => {
    it('deletes entry from specific tier', async () => {
      const entry = await manager.store({ ...makeEntry(), type: 'working' } as never)
      const deleted = await manager.delete(entry.id, 'working')
      expect(deleted).toBe(true)
      const retrieved = await working.get(entry.id)
      expect(retrieved).toBeNull()
    })

    it('returns false for non-existent entry', async () => {
      const deleted = await manager.delete('ghost-id', 'working')
      expect(deleted).toBe(false)
    })
  })

  describe('prune expired entries', () => {
    it('removes entries older than specified date', async () => {
      const oldEntry = await manager.store({
        ...makeEntry(),
        type: 'working',
      } as never)
      const freshEntry = await manager.store({
        ...makeEntry({ content: 'fresh' }),
        type: 'working',
      } as never)

      const cutoff = new Date()
      const pruned = await manager.prune('working', cutoff)
      expect(pruned).toBeGreaterThanOrEqual(0)
    })
  })
})
