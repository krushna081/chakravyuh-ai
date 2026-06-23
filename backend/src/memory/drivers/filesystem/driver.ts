import fs from 'node:fs'
import path from 'node:path'
import { type ProceduralMemoryDriver } from '../../interfaces.js'
import type { MemoryEntry } from '../../types.js'

function sanitizePathComponent(part: string): string {
  return part.replace(/[<>:"\/\\|?*]/g, '_').replace(/\s+/g, '_')
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

async function readTextFile(filePath: string): Promise<string | null> {
  try {
    return await fs.promises.readFile(filePath, 'utf-8')
  } catch {
    return null
  }
}

async function writeTextFile(filePath: string, content: string): Promise<void> {
  ensureDir(path.dirname(filePath))
  await fs.promises.writeFile(filePath, content, 'utf-8')
}

async function deleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.promises.unlink(filePath)
    return true
  } catch {
    return false
  }
}

async function listFilesRecursive(dir: string, prefix: string = ''): Promise<string[]> {
  try {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true })
    const results: string[] = []

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      const relPath = prefix ? `${prefix}/${entry.name}` : entry.name

      if (entry.isDirectory()) {
        const children = await listFilesRecursive(fullPath, relPath)
        results.push(...children)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(relPath)
      }
    }

    return results
  } catch {
    return []
  }
}

function extractFrontMatter(content: string): { metadata: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) return { metadata: {}, body: content }

  const meta: Record<string, unknown> = {}
  for (const line of match[1].split('\n')) {
    const sep = line.indexOf(': ')
    if (sep > 0) {
      const key = line.slice(0, sep).trim()
      let value: unknown = line.slice(sep + 2).trim()

      if (value === 'true') value = true
      else if (value === 'false') value = false
      else if (/^\d+$/.test(value as string)) value = parseInt(value as string, 10)
      else if (/^\d+\.\d+$/.test(value as string)) value = parseFloat(value as string)

      meta[key] = value
    }
  }

  return { metadata: meta, body: match[2].trimStart() }
}

function buildMarkdown(entry: MemoryEntry): string {
  let frontMatter = '---\n'
  frontMatter += `id: ${entry.id}\n`
  frontMatter += `agent_id: ${entry.agentId}\n`
  frontMatter += `type: ${entry.type}\n`
  frontMatter += `created_at: ${entry.createdAt}\n`
  if (entry.expiresAt) frontMatter += `expires_at: ${entry.expiresAt}\n`
  if (entry.metadata) {
    for (const [key, val] of Object.entries(entry.metadata)) {
      frontMatter += `${key}: ${String(val)}\n`
    }
  }
  frontMatter += '---\n\n'

  return frontMatter + entry.content
}

export class FilesystemDriver implements ProceduralMemoryDriver {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = path.resolve(baseDir)
    ensureDir(this.baseDir)
  }

  async get(key: string): Promise<MemoryEntry | null> {
    const filePath = path.resolve(this.baseDir, key)
    if (!filePath.startsWith(this.baseDir)) return null

    const content = await readTextFile(filePath)
    if (content === null) return null

    const { metadata, body } = extractFrontMatter(content)
    const id = (metadata.id as string) ?? key
    const agentId = (metadata.agent_id as string) ?? 'unknown'
    const type = (metadata.type as MemoryEntry['type']) ?? 'procedural'
    const createdAt = (metadata.created_at as string) ?? new Date().toISOString()
    const expiresAt = metadata.expires_at as string | undefined

    return {
      id,
      agentId,
      type,
      content: body,
      metadata,
      createdAt,
      expiresAt,
    }
  }

  async set(key: string, value: MemoryEntry): Promise<void> {
    return this.store(value)
  }

  async store(entry: MemoryEntry): Promise<void> {
    const filePath = this.entryToPath(entry)
    const markdown = buildMarkdown(entry)
    await writeTextFile(filePath, markdown)
  }

  async delete(key: string): Promise<boolean> {
    const filePath = path.resolve(this.baseDir, key)
    if (!filePath.startsWith(this.baseDir)) return false
    return deleteFile(filePath)
  }

  async search(query: string): Promise<MemoryEntry[]> {
    const files = await listFilesRecursive(this.baseDir)
    const q = query.toLowerCase()
    const results: MemoryEntry[] = []

    for (const relPath of files) {
      const filePath = path.join(this.baseDir, relPath)
      const content = await readTextFile(filePath)
      if (content === null) continue

      if (content.toLowerCase().includes(q)) {
        const entry = await this.get(relPath)
        if (entry) results.push(entry)
      }
    }

    return results
  }

  async clear(): Promise<void> {
    const files = await listFilesRecursive(this.baseDir)
    for (const relPath of files) {
      const filePath = path.join(this.baseDir, relPath)
      await deleteFile(filePath).catch(() => {})
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const searchDir = prefix
      ? path.resolve(this.baseDir, prefix)
      : this.baseDir

    if (!searchDir.startsWith(this.baseDir)) return []

    return listFilesRecursive(searchDir)
  }

  async getByProcedure(procedureId: string): Promise<MemoryEntry[]> {
    const files = await listFilesRecursive(this.baseDir)
    const results: MemoryEntry[] = []

    for (const relPath of files) {
      const entry = await this.get(relPath)
      if (!entry) continue

      if (entry.id === procedureId) {
        results.push(entry)
        continue
      }

      if (entry.metadata?.procedureId === procedureId) {
        results.push(entry)
        continue
      }

      if (entry.metadata?.procedure_id === procedureId) {
        results.push(entry)
        continue
      }

      if (relPath.includes(procedureId)) {
        results.push(entry)
      }
    }

    return results
  }

  private entryToPath(entry: MemoryEntry): string {
    const typeDir = sanitizePathComponent(entry.type)
    const agentDir = sanitizePathComponent(entry.agentId)
    const timestamp = new Date(entry.createdAt).getTime()
    const safeId = sanitizePathComponent(entry.id)
    const fileName = `${timestamp}_${safeId}.md`

    return path.join(this.baseDir, typeDir, agentDir, fileName)
  }
}
