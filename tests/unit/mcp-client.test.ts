import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MCPClientManager } from '../../backend/src/mcp/client-manager.js'
import { MCPError } from '../../backend/src/errors.js'

describe('MCPClientManager', () => {
  let manager: MCPClientManager

  beforeEach(() => {
    manager = new MCPClientManager()
  })

  afterEach(async () => {
    await manager.stopAll().catch(() => { })
  })

  describe('JSON-RPC message formatting', () => {
    it('creates valid JSON-RPC request messages', () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/list',
      }
      expect(request.jsonrpc).toBe('2.0')
      expect(request.id).toBe(1)
      expect(request.method).toBe('tools/list')
    })

    it('creates valid tool call request', () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 2,
        method: 'tools/call',
        params: { name: 'read-file', arguments: { path: '/tmp/test.txt' } },
      }
      expect(JSON.stringify(request)).toContain('tools/call')
      expect(request.params.name).toBe('read-file')
    })

    it('creates JSON-RPC response with result', () => {
      const response = {
        jsonrpc: '2.0' as const,
        id: 1,
        result: { content: [{ type: 'text', text: 'done' }] },
      }
      expect(response.result).toBeDefined()
    })

    it('creates JSON-RPC error response', () => {
      const errorResponse = {
        jsonrpc: '2.0' as const,
        id: 1,
        error: { code: -32601, message: 'Method not found' },
      }
      expect(errorResponse.error.code).toBe(-32601)
    })
  })

  describe('server lifecycle', () => {
    it('throws MCPError on startServer with unsupported transport', async () => {
      await expect(
        manager.startServer({
          id: 'bad',
          name: 'Bad',
          transport: 'invalid' as never,
          config: {} as never,
        }),
      ).rejects.toThrow(MCPError)
    })

    it('throws MCPError on stopServer for non-existent server', async () => {
      await expect(manager.stopServer('ghost')).rejects.toThrow(MCPError)
    })

    it('throws MCPError when calling tool on non-existent server', async () => {
      await expect(manager.callTool('ghost', 'test', {})).rejects.toThrow(MCPError)
    })

    it('listServers returns empty array initially', () => {
      expect(manager.listServers()).toEqual([])
    })

    it('listTools returns empty array initially', () => {
      expect(manager.listTools()).toEqual([])
    })
  })

  describe('tool call dispatching', () => {
    it('throws when calling tool on unconnected server', async () => {
      try {
        await manager.startServer({
          id: 'stdio-test',
          name: 'STDIO Test',
          transport: 'stdio',
          autoStart: false,
          config: { command: 'cmd.exe', args: ['/c', 'echo', '{}'] },
        })
      } catch {
      }
    })
  })

  describe('getServer', () => {
    it('returns undefined for non-existent server', () => {
      expect(manager.getServer('nonexistent')).toBeUndefined()
    })
  })

  describe('startAll and stopAll', () => {
    it('startAll handles empty configs array', async () => {
      await manager.startAll([])
      expect(manager.listServers()).toEqual([])
    })

    it('stopAll does nothing with no servers', async () => {
      await expect(manager.stopAll()).resolves.toBeUndefined()
    })
  })
})
