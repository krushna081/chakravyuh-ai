import { createInterface } from 'node:readline'
import { existsSync } from 'node:fs'

const SERVER_NAME = 'database'
const DATABASE_URL = process.env.DATABASE_URL ?? ''
const READ_ONLY = process.env.DATABASE_READ_ONLY !== 'false'

interface JSONRPCRequest {
  jsonrpc: '2.0'
  id: string | number
  method: string
  params?: Record<string, unknown>
}

interface JSONRPCResponse {
  jsonrpc: '2.0'
  id: string | number
  result?: unknown
  error?: { code: number; message: string; data?: unknown }
}

type DatabaseType = 'sqlite' | 'postgresql' | 'unknown'

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue: string | null
  isPrimaryKey: boolean
}

interface TableInfo {
  name: string
  columns: ColumnInfo[]
}

type SqliteRow = Record<string, unknown>

function makeResponse(id: string | number, result?: unknown, error?: { code: number; message: string; data?: unknown }): JSONRPCResponse {
  return { jsonrpc: '2.0', id, ...(error ? { error } : { result }) }
}

function makeError(code: number, message: string, data?: unknown): { code: number; message: string; data?: unknown } {
  return { code, message, data }
}

function validateString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`"${name}" must be a non-empty string`)
  return value
}

function detectDatabaseType(url: string): DatabaseType {
  if (url.startsWith('sqlite:')) return 'sqlite'
  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) return 'postgresql'
  return 'unknown'
}

function getSqlitePath(url: string): string {
  const path = url.replace(/^sqlite:/, '')
  if (path === ':memory:') return ':memory:'
  return path
}

async function querySqlite(sql: string, params: unknown[] = []): Promise<{ rows: SqliteRow[]; rowCount: number; columns: string[] }> {
  const dbPath = getSqlitePath(DATABASE_URL)

  const { default: Database } = await import('better-sqlite3')

  const db = new Database(dbPath, { readonly: READ_ONLY && !isWriteQuery(sql) })
  try {
    const stmt = db.prepare(sql)
    const rows = stmt.all(...params) as SqliteRow[]
    const columns = stmt.columns().map((c: { name: string }) => c.name)
    return { rows, rowCount: rows.length, columns }
  } finally {
    db.close()
  }
}

async function executeSqlite(sql: string, params: unknown[] = []): Promise<{ affectedRows: number; lastInsertRowid?: number | bigint }> {
  const dbPath = getSqlitePath(DATABASE_URL)

  const { default: Database } = await import('better-sqlite3')

  const db = new Database(dbPath)
  try {
    const stmt = db.prepare(sql)
    const result = stmt.run(...params)
    return { affectedRows: result.changes, lastInsertRowid: result.lastInsertRowid }
  } finally {
    db.close()
  }
}

async function listSqliteTables(): Promise<string[]> {
  const result = await querySqlite("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  return result.rows.map((r: SqliteRow) => r.name as string)
}

async function describeSqliteTable(tableName: string): Promise<ColumnInfo[]> {
  const result = await querySqlite(`PRAGMA table_info("${tableName}")`)
  return result.rows.map((r: SqliteRow) => ({
    name: r.name as string,
    type: r.type as string,
    nullable: (r.notnull as number) === 0,
    defaultValue: r.dflt_value as string | null,
    isPrimaryKey: (r.pk as number) === 1,
  }))
}

async function queryPostgresql(sql: string, params: unknown[] = []): Promise<{ rows: SqliteRow[]; rowCount: number; columns: string[] }> {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const result = await client.query(sql, params)
    return {
      rows: result.rows as SqliteRow[],
      rowCount: result.rowCount ?? 0,
      columns: result.fields.map((f: { name: string }) => f.name),
    }
  } finally {
    await client.end()
  }
}

async function executePostgresql(sql: string, params: unknown[] = []): Promise<{ affectedRows: number }> {
  const { default: pg } = await import('pg')
  const client = new pg.Client({ connectionString: DATABASE_URL })
  await client.connect()
  try {
    const result = await client.query(sql, params)
    return { affectedRows: result.rowCount ?? 0 }
  } finally {
    await client.end()
  }
}

async function listPostgresqlTables(): Promise<string[]> {
  const result = await queryPostgresql(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
  )
  return result.rows.map((r: SqliteRow) => r.table_name as string)
}

async function describePostgresqlTable(tableName: string): Promise<ColumnInfo[]> {
  const result = await queryPostgresql(
    `SELECT
      c.column_name AS name,
      c.data_type AS type,
      c.is_nullable = 'YES' AS nullable,
      c.column_default AS default_value,
      CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
    FROM information_schema.columns c
    LEFT JOIN (
      SELECT ku.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage ku ON tc.constraint_name = ku.constraint_name
      WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_name = $1
    ) pk ON c.column_name = pk.column_name
    WHERE c.table_name = $1
    ORDER BY c.ordinal_position`,
    [tableName],
  )
  return result.rows.map((r: SqliteRow) => ({
    name: r.name as string,
    type: r.type as string,
    nullable: r.nullable as boolean,
    defaultValue: r.default_value as string | null,
    isPrimaryKey: r.is_primary_key as boolean,
  }))
}

function getSqliteSchemaSql(): string {
  return "SELECT sql FROM sqlite_master WHERE type IN ('table', 'index', 'view', 'trigger') AND sql IS NOT NULL ORDER BY type, name"
}

async function getPostgresqlSchema(): Promise<string> {
  const result = await queryPostgresql(
    `SELECT
      table_name,
      string_agg(column_name || ' ' || data_type || CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END, ', ') AS columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
    GROUP BY table_name
    ORDER BY table_name`,
  )
  return result.rows.map((r: SqliteRow) => `CREATE TABLE ${r.table_name} (${r.columns});`).join('\n')
}

function isWriteQuery(sql: string): boolean {
  const trimmed = sql.trim().toUpperCase()
  return trimmed.startsWith('INSERT') || trimmed.startsWith('UPDATE') || trimmed.startsWith('DELETE') ||
    trimmed.startsWith('CREATE') || trimmed.startsWith('DROP') || trimmed.startsWith('ALTER') ||
    trimmed.startsWith('TRUNCATE') || trimmed.startsWith('REPLACE')
}

async function handleRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { id, method, params = {} } = req

  try {
    const dbType = detectDatabaseType(DATABASE_URL)
    if (dbType === 'unknown') {
      return makeResponse(id, undefined, makeError(500, 'Unsupported database type. DATABASE_URL must start with "sqlite:" or "postgresql://"'))
    }

    switch (method) {
      case 'query': {
        const sql = validateString(params.sql, 'sql')
        const queryParams = Array.isArray(params.params) ? params.params : []

        if (READ_ONLY && isWriteQuery(sql)) {
          return makeResponse(id, undefined, makeError(403, 'Database is in read-only mode. Write queries are not allowed.'))
        }

        const result = dbType === 'sqlite'
          ? await querySqlite(sql, queryParams)
          : await queryPostgresql(sql, queryParams)
        return makeResponse(id, result)
      }

      case 'execute': {
        const sql = validateString(params.sql, 'sql')
        const execParams = Array.isArray(params.params) ? params.params : []

        if (!isWriteQuery(sql)) {
          return makeResponse(id, undefined, makeError(400, 'execute is for write operations. Use query for SELECT statements.'))
        }

        if (READ_ONLY) {
          return makeResponse(id, undefined, makeError(403, 'Database is in read-only mode'))
        }

        const result = dbType === 'sqlite'
          ? await executeSqlite(sql, execParams)
          : await executePostgresql(sql, execParams)
        return makeResponse(id, result)
      }

      case 'list_tables': {
        const tables = dbType === 'sqlite'
          ? await listSqliteTables()
          : await listPostgresqlTables()
        return makeResponse(id, { tables, total: tables.length })
      }

      case 'describe_table': {
        const tableName = validateString(params.table, 'table')
        const columns = dbType === 'sqlite'
          ? await describeSqliteTable(tableName)
          : await describePostgresqlTable(tableName)
        return makeResponse(id, { table: tableName, columns, total: columns.length })
      }

      case 'get_schema': {
        if (dbType === 'sqlite') {
          const result = await querySqlite(getSqliteSchemaSql())
          return makeResponse(id, {
            database: getSqlitePath(DATABASE_URL),
            type: 'sqlite',
            schema: result.rows.map((r: SqliteRow) => (r.sql as string)).join('\n\n'),
          })
        } else {
          const schema = await getPostgresqlSchema()
          return makeResponse(id, {
            database: DATABASE_URL,
            type: 'postgresql',
            schema,
          })
        }
      }

      default:
        return makeResponse(id, undefined, makeError(-32601, `Method not found: ${method}`))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = message.includes('read-only') || message.includes('not allowed') ? 403
      : message.includes('not found') || message.includes('no such table') ? 404
      : message.includes('syntax error') ? 400
      : 500
    return makeResponse(id, undefined, makeError(code, message))
  }
}

const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })

rl.on('line', async (line: string) => {
  const trimmed = line.trim()
  if (!trimmed) return

  let request: JSONRPCRequest
  try {
    request = JSON.parse(trimmed) as JSONRPCRequest
    if (request.jsonrpc !== '2.0' || !request.method) throw new Error('Invalid JSON-RPC 2.0 request')
  } catch (parseError) {
    process.stdout.write(JSON.stringify({
      jsonrpc: '2.0',
      id: null as unknown as string | number,
      error: { code: -32700, message: 'Parse error', data: parseError instanceof Error ? parseError.message : String(parseError) },
    }) + '\n')
    return
  }

  const response = await handleRequest(request)
  process.stdout.write(JSON.stringify(response) + '\n')
})

rl.on('close', () => process.exit(0))

process.on('uncaughtException', (error) => {
  process.stderr.write(`[${SERVER_NAME}] Uncaught exception: ${error.message}\n`)
  process.exit(1)
})

process.stderr.write(`[${SERVER_NAME}] Database MCP server started\n`)
process.stderr.write(`[${SERVER_NAME}] Database type: ${detectDatabaseType(DATABASE_URL)}\n`)
process.stderr.write(`[${SERVER_NAME}] Read-only mode: ${READ_ONLY}\n`)
