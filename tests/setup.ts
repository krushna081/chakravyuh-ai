import { beforeAll, afterAll, vi } from 'vitest'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const TEST_TMP_DIR = path.join(os.tmpdir(), 'chakravyuh-test-' + crypto.randomUUID())

beforeAll(() => {
  process.env.CHAKRAVYUH_LOG_LEVEL = 'error'
  process.env.NODE_ENV = 'test'
  process.env.OPENAI_API_KEY = 'sk-test-fake-key'
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test-fake-key'
  process.env.DEEPSEEK_API_KEY = 'sk-test-fake-key'
  process.env.GOOGLE_API_KEY = 'test-fake-key'
  process.env.GROK_API_KEY = 'test-fake-key'
  process.env.OPENROUTER_API_KEY = 'sk-test-fake-key'

  if (!fs.existsSync(TEST_TMP_DIR)) {
    fs.mkdirSync(TEST_TMP_DIR, { recursive: true })
  }
})

afterAll(() => {
  if (fs.existsSync(TEST_TMP_DIR)) {
    try {
      fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true })
    } catch {
    }
  }

  delete process.env.CHAKRAVYUH_LOG_LEVEL
  delete process.env.NODE_ENV
  delete process.env.OPENAI_API_KEY
  delete process.env.ANTHROPIC_API_KEY
  delete process.env.DEEPSEEK_API_KEY
  delete process.env.GOOGLE_API_KEY
  delete process.env.GROK_API_KEY
  delete process.env.OPENROUTER_API_KEY
})

export function createTempYaml(dir: string, filename: string, content: string): string {
  const filePath = path.join(dir, filename)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

export function getTestTmpDir(): string {
  const dir = path.join(TEST_TMP_DIR, crypto.randomUUID())
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

export function createMockAgentMessage(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: crypto.randomUUID(),
    from: 'test-agent',
    to: 'target-agent',
    type: 'request',
    priority: 'medium',
    payload: { task: 'do something', data: {} },
    metadata: {
      timestamp: new Date().toISOString(),
      ttl: 30000,
      traceId: crypto.randomUUID(),
      correlationId: crypto.randomUUID(),
    },
    ...overrides,
  }
}
