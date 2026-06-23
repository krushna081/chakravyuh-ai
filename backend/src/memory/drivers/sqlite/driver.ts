import type { EpisodicMemoryDriver } from '../../interfaces.js'
import type { MemoryEntry } from '../../types.js'

interface ConversationRow {
  id: string
  agent_id: string
  content: string
  metadata: string
  created_at: string
  expires_at: string | null
}

let BetterSqlite3: any = null
try {
  BetterSqlite3 = (await import('better-sqlite3')).default
} catch {
  // better-sqlite3 not available — will use fallback
}

const SQL_CREATE = `
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    agent_id TEXT NOT NULL,
    content TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    created_at TEXT NOT NULL,
    expires_at TEXT
  )
`

const SQL_INSERT = `
  INSERT INTO conversations (id, agent_id, content, metadata, created_at, expires_at)
  VALUES (@id, @agent_id, @content, @metadata, @created_at, @expires_at)
`

const SQL_GET = `SELECT * FROM conversations WHERE id = ?`
const SQL_DELETE = `DELETE FROM conversations WHERE id = ?`
const SQL_DELETE_EXPIRED = `DELETE FROM conversations WHERE expires_at IS NOT NULL AND expires_at < datetime('now')`
const SQL_COUNT = `SELECT COUNT(*) as count FROM conversations`
const SQL_GET_RECENT = `
  SELECT * FROM conversations
  WHERE agent_id = ?
  ORDER BY created_at DESC
  LIMIT ?
`

const SQL_SEARCH = `
  SELECT * FROM conversations
  WHERE content LIKE ?
  ORDER BY created_at DESC
`

const SQL_SEARCH_AGENT = `
  SELECT * FROM conversations
  WHERE agent_id = ? AND content LIKE ?
  ORDER BY created_at DESC
`

export class SqliteDriver implements EpisodicMemoryDriver {
  private db: any
  private entries: Map<string, MemoryEntry> = new Map()
  private fallback: boolean

  constructor(dbPath?: string) {
    if (BetterSqlite3) {
      this.fallback = false
      this.db = new BetterSqlite3(dbPath ?? ':memory:')
      this.db.exec(SQL_CREATE)
    } else {
      this.fallback = true
    }
  }

  async get(id: string): Promise<MemoryEntry | null> {
    if (this.fallback) return this.entries.get(id) ?? null

    const row = this.db.prepare(SQL_GET).get(id) as ConversationRow | undefined
    if (!row) return null

    return this.rowToEntry(row)
  }

  async set(key: string, value: MemoryEntry): Promise<void> {
    if (this.fallback) {
      this.entries.set(key, value)
      return
    }

    await this.store(value)
  }

  async store(entry: MemoryEntry): Promise<void> {
    if (this.fallback) {
      this.entries.set(entry.id, entry)
      return
    }

    const row: ConversationRow = {
      id: entry.id,
      agent_id: entry.agentId,
      content: entry.content,
      metadata: JSON.stringify(entry.metadata ?? {}),
      created_at: entry.createdAt,
      expires_at: entry.expiresAt ?? null,
    }

    this.db.prepare(SQL_INSERT).run(row)
  }

  async search(query: string): Promise<MemoryEntry[]> {
    if (this.fallback) {
      const q = query.toLowerCase()
      const results: MemoryEntry[] = []

      for (const entry of this.entries.values()) {
        if (this.isExpired(entry)) {
          this.entries.delete(entry.id)
          continue
        }
        if (
          entry.content.toLowerCase().includes(q) ||
          entry.agentId.toLowerCase().includes(q)
        ) {
          results.push(entry)
        }
      }

      return results
    }

    const pattern = `%${query}%`
    const rows = this.db.prepare(SQL_SEARCH).all(pattern) as ConversationRow[]
    return rows.map((r) => this.rowToEntry(r))
  }

  async delete(id: string): Promise<boolean> {
    if (this.fallback) return this.entries.delete(id)

    const result = this.db.prepare(SQL_DELETE).run(id)
    return result.changes > 0
  }

  async clear(): Promise<void> {
    if (this.fallback) {
      this.entries.clear()
      return
    }

    this.db.exec('DELETE FROM conversations')
  }

  async prune(): Promise<number> {
    if (this.fallback) {
      const now = Date.now()
      let count = 0
      for (const [id, entry] of this.entries) {
        if (entry.expiresAt && new Date(entry.expiresAt).getTime() < now) {
          this.entries.delete(id)
          count++
        }
      }
      return count
    }

    const result = this.db.prepare(SQL_DELETE_EXPIRED).run()
    return result.changes
  }

  async getRecent(agentId: string, limit = 50): Promise<MemoryEntry[]> {
    if (this.fallback) {
      return Array.from(this.entries.values())
        .filter((e) => e.agentId === agentId && !this.isExpired(e))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, limit)
    }

    const rows = this.db.prepare(SQL_GET_RECENT).all(agentId, limit) as ConversationRow[]
    return rows.map((r) => this.rowToEntry(r))
  }

  async getByEpisode(episodeId: string): Promise<MemoryEntry[]> {
    const q = episodeId.toLowerCase()

    if (this.fallback) {
      return Array.from(this.entries.values()).filter((e) => {
        if (this.isExpired(e)) return false
        if (e.metadata?.episodeId === episodeId) return true
        if (e.metadata?.episode_id === episodeId) return true
        return false
      })
    }

    const pattern = `%${q}%`
    const rows = this.db.prepare(SQL_SEARCH).all(pattern) as ConversationRow[]
    return rows
      .map((r) => this.rowToEntry(r))
      .filter((e) => {
        if (!e.metadata) return false
        return e.metadata.episodeId === episodeId || e.metadata.episode_id === episodeId
      })
  }

  async count(): Promise<number> {
    if (this.fallback) return this.entries.size

    const row = this.db.prepare(SQL_COUNT).get() as { count: number }
    return row.count
  }

  private rowToEntry(row: ConversationRow): MemoryEntry {
    return {
      id: row.id,
      agentId: row.agent_id,
      type: 'episodic',
      content: row.content,
      metadata: JSON.parse(row.metadata || '{}'),
      createdAt: row.created_at,
      expiresAt: row.expires_at ?? undefined,
    }
  }

  private isExpired(entry: MemoryEntry): boolean {
    if (!entry.expiresAt) return false
    return new Date(entry.expiresAt).getTime() < Date.now()
  }
}
