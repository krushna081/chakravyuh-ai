import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { logger } from '../logger.js'

export interface AuditEntry {
  id: string
  action: string
  actor: string
  resource: string
  result: 'success' | 'failure' | 'denied'
  timestamp: string
  details?: Record<string, unknown>
}

export interface AuditConfig {
  logDir: string
  maxFileSize: number
  maxFiles: number
  enabled: boolean
}

export class AuditLogger {
  private config: AuditConfig
  private currentSize: number = 0
  private currentFilePath: string
  private log = logger.child({ source: 'AuditLogger' })
  private writeStream: fs.WriteStream | null = null

  constructor(config?: Partial<AuditConfig>) {
    this.config = {
      logDir: config?.logDir ?? 'audit-logs',
      maxFileSize: config?.maxFileSize ?? 10 * 1024 * 1024,
      maxFiles: config?.maxFiles ?? 10,
      enabled: config?.enabled ?? true,
    }

    this.currentFilePath = this.generateFilePath()
  }

  private generateFilePath(index?: number): string {
    const date = new Date().toISOString().split('T')[0]!
    const suffix = index !== undefined ? `.${index}` : ''
    return path.join(this.config.logDir, `audit-${date}${suffix}.jsonl`)
  }

  private async ensureDir(): Promise<void> {
    try {
      await fsp.mkdir(this.config.logDir, { recursive: true })
    } catch (error) {
      this.log.error('Failed to create audit log directory', { error })
    }
  }

  private async getCurrentSize(): Promise<number> {
    try {
      const stat = await fsp.stat(this.currentFilePath)
      return stat.size
    } catch {
      return 0
    }
  }

  private async rotateIfNeeded(): Promise<void> {
    if (this.currentSize < this.config.maxFileSize) return

    for (let i = this.config.maxFiles - 1; i > 0; i--) {
      const oldPath = this.generateFilePath(i)
      const newPath = this.generateFilePath(i + 1)
      try {
        await fsp.rename(oldPath, newPath)
      } catch {}
    }

    const firstPath = this.generateFilePath(1)
    try {
      await fsp.rename(this.currentFilePath, firstPath)
    } catch {}

    this.currentFilePath = this.generateFilePath()
    this.currentSize = 0
  }

  private async rotateLogs(): Promise<void> {
    try {
      const files = await fsp.readdir(this.config.logDir)
      const auditFiles = files
        .filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl'))
        .sort()
        .reverse()

      for (let i = this.config.maxFiles - 1; i < auditFiles.length; i++) {
        const filePath = path.join(this.config.logDir, auditFiles[i]!)
        try {
          await fsp.unlink(filePath)
          this.log.info(`Removed old audit log: ${auditFiles[i]}`)
        } catch (error) {
          this.log.error('Failed to remove old audit log', { error })
        }
      }
    } catch (error) {
      this.log.error('Failed to rotate audit logs', { error })
    }
  }

  async log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<void> {
    if (!this.config.enabled) return

    const fullEntry: AuditEntry = {
      ...entry,
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    }

    await this.ensureDir()
    await this.rotateIfNeeded()

    const line = JSON.stringify(fullEntry) + '\n'
    const bytes = Buffer.byteLength(line, 'utf-8')

    try {
      await fsp.appendFile(this.currentFilePath, line, 'utf-8')
      this.currentSize += bytes
      this.log.info(`Audit: ${entry.action} by ${entry.actor} on ${entry.resource} -> ${entry.result}`)
    } catch (error) {
      this.log.error('Failed to write audit log entry', { error })
    }
  }

  async query(filters: Partial<AuditEntry> & { startDate?: string; endDate?: string }): Promise<AuditEntry[]> {
    const results: AuditEntry[] = []

    try {
      await this.ensureDir()
      const files = await fsp.readdir(this.config.logDir)
      const auditFiles = files
        .filter((f) => f.startsWith('audit-') && f.endsWith('.jsonl'))
        .sort()

      for (const file of auditFiles) {
        const content = await fsp.readFile(path.join(this.config.logDir, file), 'utf-8')
        const lines = content.split('\n').filter(Boolean)

        for (const line of lines) {
          try {
            const entry: AuditEntry = JSON.parse(line)
            if (this.matchesFilter(entry, filters)) {
              results.push(entry)
            }
          } catch {}
        }
      }
    } catch (error) {
      this.log.error('Failed to query audit logs', { error })
    }

    return results
  }

  private matchesFilter(entry: AuditEntry, filters: Partial<AuditEntry> & { startDate?: string; endDate?: string }): boolean {
    for (const [key, value] of Object.entries(filters)) {
      if (key === 'startDate' || key === 'endDate') continue
      if (value !== undefined && entry[key as keyof AuditEntry] !== value) {
        return false
      }
    }

    if (filters.startDate && entry.timestamp < filters.startDate) return false
    if (filters.endDate && entry.timestamp > filters.endDate) return false

    return true
  }

  async close(): Promise<void> {
    this.writeStream?.end()
    this.writeStream = null
  }
}
