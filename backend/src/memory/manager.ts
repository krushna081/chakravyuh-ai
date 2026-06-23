import crypto from 'node:crypto'
import type { MemoryEntry, MemoryType } from '../types.js'
import { ValidationError } from '../errors.js'
import { logger } from '../logger.js'
import type { MemoryDriver, MemoryStore, WorkingMemoryDriver, EpisodicMemoryDriver, SemanticMemoryDriver, ProceduralMemoryDriver } from './interfaces.js'

export class MemoryManager implements MemoryStore {
  private working: WorkingMemoryDriver
  private episodic: EpisodicMemoryDriver
  private semantic: SemanticMemoryDriver
  private procedural: ProceduralMemoryDriver
  private writeThrough: boolean

  constructor(
    working: WorkingMemoryDriver,
    episodic: EpisodicMemoryDriver,
    semantic: SemanticMemoryDriver,
    procedural: ProceduralMemoryDriver,
    writeThrough = true,
  ) {
    this.working = working
    this.episodic = episodic
    this.semantic = semantic
    this.procedural = procedural
    this.writeThrough = writeThrough
  }

  private selectDriver(type: MemoryType): MemoryDriver {
    switch (type) {
      case 'working': return this.working
      case 'episodic': return this.episodic
      case 'semantic': return this.semantic
      case 'procedural': return this.procedural
    }
  }

  async store(entry: Omit<MemoryEntry, 'id' | 'createdAt'>): Promise<MemoryEntry> {
    if (!entry.agentId || !entry.content) {
      throw new ValidationError('Memory entry requires agentId and content')
    }

    const full: MemoryEntry = {
      ...entry,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      metadata: { ...entry.metadata },
    }

    const driver = this.selectDriver(entry.type)
    const log = logger.child({ source: 'MemoryManager', correlationId: full.id })

    try {
      await driver.set(full.id, full)
      log.info(`Stored memory entry ${full.id} in ${entry.type} memory`)

      if (this.writeThrough && entry.type !== 'working') {
        await this.working.set(full.id, full)
      }

      return full
    } catch (error) {
      log.error('Failed to store memory entry', { error })
      throw error
    }
  }

  async retrieve(id: string, type: MemoryType): Promise<MemoryEntry | null> {
    const driver = this.selectDriver(type)
    const log = logger.child({ source: 'MemoryManager', correlationId: id })

    try {
      const entry = await driver.get(id)

      if (!entry) {
        log.warn(`Memory entry ${id} not found in ${type} memory`)
        return null
      }

      if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
        await driver.delete(id)
        log.info(`Purged expired memory entry ${id}`)
        return null
      }

      return entry
    } catch (error) {
      log.error('Failed to retrieve memory entry', { error })
      throw error
    }
  }

  async search(query: string, type: MemoryType): Promise<MemoryEntry[]> {
    if (!query.trim()) {
      throw new ValidationError('Search query must not be empty')
    }

    const driver = this.selectDriver(type)
    const log = logger.child({ source: 'MemoryManager' })

    try {
      const results = await driver.search(query)

      const valid = results.filter((entry) => {
        if (!entry.expiresAt) return true
        return new Date(entry.expiresAt) >= new Date()
      })

      log.info(`Found ${valid.length} results in ${type} memory for query`)
      return valid
    } catch (error) {
      log.error('Failed to search memory', { error })
      throw error
    }
  }

  async delete(id: string, type: MemoryType): Promise<boolean> {
    const driver = this.selectDriver(type)
    const log = logger.child({ source: 'MemoryManager', correlationId: id })

    try {
      const result = await driver.delete(id)

      if (this.writeThrough) {
        const tiers: MemoryType[] = ['working', 'episodic', 'semantic', 'procedural']
        for (const tier of tiers) {
          if (tier !== type) {
            const otherDriver = this.selectDriver(tier)
            await otherDriver.delete(id).catch(() => {})
          }
        }
      }

      if (result) {
        log.info(`Deleted memory entry ${id} from ${type} memory`)
      }

      return result
    } catch (error) {
      log.error('Failed to delete memory entry', { error })
      throw error
    }
  }

  async prune(type: MemoryType, olderThan: Date): Promise<number> {
    const driver = this.selectDriver(type)
    const log = logger.child({ source: 'MemoryManager' })

    try {
      const allEntries = await driver.search('')
      let prunedCount = 0

      for (const entry of allEntries) {
        const createdAt = new Date(entry.createdAt)
        if (createdAt < olderThan) {
          await driver.delete(entry.id)
          prunedCount++
        }
      }

      log.info(`Pruned ${prunedCount} entries from ${type} memory`)
      return prunedCount
    } catch (error) {
      log.error('Failed to prune memory', { error })
      throw error
    }
  }
}
