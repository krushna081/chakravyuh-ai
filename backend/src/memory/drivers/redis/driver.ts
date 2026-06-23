import type { WorkingMemoryDriver } from '../../interfaces.js'
import type { MemoryEntry } from '../../types.js'

interface CacheEntry {
  value: MemoryEntry
  expiresAt: number | null
}

export class RedisDriver implements WorkingMemoryDriver {
  private store: Map<string, CacheEntry> = new Map()
  private defaultTtl: number

  constructor(defaultTtl = 3600) {
    this.defaultTtl = defaultTtl
  }

  async get(key: string): Promise<MemoryEntry | null> {
    const entry = this.store.get(key)
    if (!entry) return null

    if (entry.expiresAt !== null && Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return null
    }

    return entry.value
  }

  async set(key: string, value: MemoryEntry, ttl?: number): Promise<void> {
    const ttlMs = ttl !== undefined ? ttl * 1000 : this.defaultTtl * 1000
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    })
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(key)
  }

  async search(query: string): Promise<MemoryEntry[]> {
    const q = query.toLowerCase()
    const results: MemoryEntry[] = []
    const now = Date.now()

    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key)
        continue
      }

      const { value } = entry
      if (
        value.content.toLowerCase().includes(q) ||
        value.agentId.toLowerCase().includes(q) ||
        value.id.toLowerCase().includes(q) ||
        this.metadataMatches(value.metadata, q)
      ) {
        results.push(value)
      }
    }

    return results
  }

  async clear(): Promise<void> {
    this.store.clear()
  }

  async getAll(): Promise<MemoryEntry[]> {
    const results: MemoryEntry[] = []
    const now = Date.now()

    for (const [key, entry] of this.store) {
      if (entry.expiresAt !== null && now > entry.expiresAt) {
        this.store.delete(key)
        continue
      }
      results.push(entry.value)
    }

    return results
  }

  async getRecent(agentId: string, limit?: number): Promise<MemoryEntry[]> {
    const entries = await this.getAll()
    const filtered = entries
      .filter((e) => e.agentId === agentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return limit ? filtered.slice(0, limit) : filtered
  }

  private metadataMatches(metadata: Record<string, unknown> | undefined, query: string): boolean {
    if (!metadata) return false
    return Object.values(metadata).some((val) => {
      if (typeof val === 'string') return val.toLowerCase().includes(query)
      if (typeof val === 'number' || typeof val === 'boolean') return String(val).includes(query)
      return false
    })
  }
}
