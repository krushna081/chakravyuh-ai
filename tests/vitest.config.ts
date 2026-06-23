import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['backend/src/**/*.ts', 'agents/**/*.ts', 'mcp/**/*.ts', 'memory/**/*.ts'],
    },
    setupFiles: ['tests/setup.ts'],
  },
  resolve: {
    alias: {
      '@chakravyuh/core': path.resolve(__dirname, '../backend/src/index.ts'),
      '@chakravyuh/providers': path.resolve(__dirname, '../backend/src/providers/index.ts'),
      '@chakravyuh/memory': path.resolve(__dirname, '../backend/src/memory/index.ts'),
      '@chakravyuh/mcp': path.resolve(__dirname, '../backend/src/mcp/index.ts'),
    },
  },
})
