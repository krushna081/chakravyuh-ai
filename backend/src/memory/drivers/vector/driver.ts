import type { SemanticMemoryDriver } from '../../interfaces.js'
import type { MemoryEntry } from '../../types.js'

interface VectorEntry {
  id: string
  vector: number[]
  entry: MemoryEntry
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

function placeholderEmbed(text: string, dimensions = 128): number[] {
  const vector: number[] = new Array(dimensions)
  let hash = 0

  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash) + text.charCodeAt(i)
    hash = hash & hash
  }

  const seed = Math.abs(hash) || 1
  const rng = mulberry32(seed)

  for (let i = 0; i < dimensions; i++) {
    vector[i] = rng()
  }

  return normalizeVector(vector)
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normalizeVector(v: number[]): number[] {
  const mag = Math.sqrt(v.reduce((sum, val) => sum + val * val, 0))
  return mag === 0 ? v : v.map((val) => val / mag)
}

class InMemoryVectorDriver implements SemanticMemoryDriver {
  private entries: VectorEntry[] = []

  async store(entry: MemoryEntry): Promise<void> {
    const content = `${entry.content} ${entry.agentId} ${Object.values(entry.metadata ?? {}).join(' ')}`
    const vector = placeholderEmbed(content)

    const existing = this.entries.findIndex((e) => e.id === entry.id)
    if (existing >= 0) {
      this.entries[existing] = { id: entry.id, vector, entry }
    } else {
      this.entries.push({ id: entry.id, vector, entry })
    }
  }

  async get(key: string): Promise<MemoryEntry | null> {
    const found = this.entries.find((e) => e.id === key)
    return found ? found.entry : null
  }

  async set(key: string, value: MemoryEntry): Promise<void> {
    return this.store(value)
  }

  async search(query: string, topK = 10): Promise<MemoryEntry[]> {
    const queryVec = placeholderEmbed(query)
    const scored = this.entries
      .map((e) => ({
        entry: e.entry,
        score: cosineSimilarity(queryVec, e.vector),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)

    return scored.map((s) => s.entry)
  }

  async delete(id: string): Promise<boolean> {
    const idx = this.entries.findIndex((e) => e.id === id)
    if (idx < 0) return false
    this.entries.splice(idx, 1)
    return true
  }

  async clear(): Promise<void> {
    this.entries = []
  }

  async getByConcept(concept: string): Promise<MemoryEntry[]> {
    return this.search(concept, 20)
  }

  vectorCount(): number {
    return this.entries.length
  }
}

export function createVectorDriver(url?: string): SemanticMemoryDriver {
  const vectorDbUrl = url ?? process.env.VECTOR_DB_URL ?? ''

  if (vectorDbUrl.startsWith('http') && vectorDbUrl.includes('qdrant')) {
    return new QdrantDriver(vectorDbUrl)
  }

  if (vectorDbUrl.startsWith('https') && vectorDbUrl.includes('pinecone')) {
    return new PineconeDriver(vectorDbUrl)
  }

  if (vectorDbUrl.startsWith('postgres') || vectorDbUrl.startsWith('postgresql')) {
    return new PgvectorDriver(vectorDbUrl)
  }

  return new InMemoryVectorDriver()
}

export { InMemoryVectorDriver }

class QdrantDriver implements SemanticMemoryDriver {
  private baseUrl: string
  private fallback: InMemoryVectorDriver

  constructor(url: string) {
    this.baseUrl = url.replace(/\/$/, '')
    this.fallback = new InMemoryVectorDriver()
  }

  async get(key: string): Promise<MemoryEntry | null> {
    return this.fallback.get(key)
  }

  async set(key: string, value: MemoryEntry): Promise<void> {
    return this.fallback.set(key, value)
  }

  async store(entry: MemoryEntry): Promise<void> {
    this.fallback.store(entry)
  }

  async search(query: string, topK = 10): Promise<MemoryEntry[]> {
    return this.fallback.search(query, topK)
  }

  async delete(id: string): Promise<boolean> {
    return this.fallback.delete(id)
  }

  async clear(): Promise<void> {
    this.fallback.clear()
  }

  async getByConcept(concept: string): Promise<MemoryEntry[]> {
    return this.fallback.getByConcept(concept)
  }
}

class PineconeDriver implements SemanticMemoryDriver {
  private fallback: InMemoryVectorDriver

  constructor(_url: string) {
    this.fallback = new InMemoryVectorDriver()
  }

  async get(key: string): Promise<MemoryEntry | null> {
    return this.fallback.get(key)
  }

  async set(key: string, value: MemoryEntry): Promise<void> {
    return this.fallback.set(key, value)
  }

  async store(entry: MemoryEntry): Promise<void> {
    this.fallback.store(entry)
  }

  async search(query: string, topK = 10): Promise<MemoryEntry[]> {
    return this.fallback.search(query, topK)
  }

  async delete(id: string): Promise<boolean> {
    return this.fallback.delete(id)
  }

  async clear(): Promise<void> {
    this.fallback.clear()
  }

  async getByConcept(concept: string): Promise<MemoryEntry[]> {
    return this.fallback.getByConcept(concept)
  }
}

class PgvectorDriver implements SemanticMemoryDriver {
  private fallback: InMemoryVectorDriver

  constructor(_url: string) {
    this.fallback = new InMemoryVectorDriver()
  }

  async get(key: string): Promise<MemoryEntry | null> {
    return this.fallback.get(key)
  }

  async set(key: string, value: MemoryEntry): Promise<void> {
    return this.fallback.set(key, value)
  }

  async store(entry: MemoryEntry): Promise<void> {
    this.fallback.store(entry)
  }

  async search(query: string, topK = 10): Promise<MemoryEntry[]> {
    return this.fallback.search(query, topK)
  }

  async delete(id: string): Promise<boolean> {
    return this.fallback.delete(id)
  }

  async clear(): Promise<void> {
    this.fallback.clear()
  }

  async getByConcept(concept: string): Promise<MemoryEntry[]> {
    return this.fallback.getByConcept(concept)
  }
}
