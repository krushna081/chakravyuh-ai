import type { MemoryEntry, MemoryType } from '../types.js'

export interface MemoryDriver {
  get(key: string): Promise<MemoryEntry | null>
  set(key: string, value: MemoryEntry, ttl?: number): Promise<void>
  delete(key: string): Promise<boolean>
  search(query: string): Promise<MemoryEntry[]>
  clear(): Promise<void>
}

export interface WorkingMemoryDriver extends MemoryDriver {
  getRecent(agentId: string, limit?: number): Promise<MemoryEntry[]>
}

export interface EpisodicMemoryDriver extends MemoryDriver {
  getByEpisode(episodeId: string): Promise<MemoryEntry[]>
}

export interface SemanticMemoryDriver extends MemoryDriver {
  getByConcept(concept: string): Promise<MemoryEntry[]>
}

export interface ProceduralMemoryDriver extends MemoryDriver {
  getByProcedure(procedureId: string): Promise<MemoryEntry[]>
}

export interface MemoryStore {
  store(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<MemoryEntry>
  retrieve(id: string, type: MemoryType): Promise<MemoryEntry | null>
  search(query: string, type: MemoryType): Promise<MemoryEntry[]>
  delete(id: string, type: MemoryType): Promise<boolean>
  prune(type: MemoryType, olderThan: Date): Promise<number>
}
