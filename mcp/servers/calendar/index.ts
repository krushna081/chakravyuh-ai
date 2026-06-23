import { createInterface } from 'node:readline'

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY ?? ''
const GOOGLE_ACCESS_TOKEN = process.env.GOOGLE_ACCESS_TOKEN ?? ''
const SERVER_NAME = 'calendar'

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

function validateOptionalString(value: unknown, name: string): string | undefined {
  if (value === undefined || value === null) return undefined
  return validateString(value, name)
}

function checkAuth(): void {
  if (!GOOGLE_ACCESS_TOKEN && !GOOGLE_API_KEY) {
    throw new Error('Google API not configured. Set GOOGLE_ACCESS_TOKEN or GOOGLE_API_KEY environment variable.')
  }
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  if (GOOGLE_ACCESS_TOKEN) headers['Authorization'] = `Bearer ${GOOGLE_ACCESS_TOKEN}`
  return headers
}

async function calendarFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const separator = path.includes('?') ? '&' : '?'
  const url = `https://www.googleapis.com/calendar/v3${path}${GOOGLE_API_KEY && !GOOGLE_ACCESS_TOKEN ? `${separator}key=${GOOGLE_API_KEY}` : ''}`
  const response = await fetch(url, {
    ...options,
    headers: { ...buildHeaders(), ...((options.headers as Record<string, string>) ?? {}) },
  })
  if (!response.ok) {
    const data = await response.text()
    throw new Error(`Calendar API error (${response.status}): ${data}`)
  }
  return response.json()
}

async function handleRequest(req: JSONRPCRequest): Promise<JSONRPCResponse> {
  const { id, method, params = {} } = req

  try {
    checkAuth()

    const calendarId = (params.calendarId as string) ?? 'primary'

    switch (method) {
      case 'list_events': {
        const timeMin = (params.timeMin as string) ?? new Date().toISOString()
        const timeMax = params.timeMax as string | undefined
        const maxResults = typeof params.maxResults === 'number' ? Math.min(params.maxResults, 500) : 50
        const orderBy = (params.orderBy as string) ?? 'startTime'
        const singleEvents = params.singleEvents !== false

        let path = `/calendars/${encodeURIComponent(calendarId)}/events?timeMin=${encodeURIComponent(timeMin)}&maxResults=${maxResults}&orderBy=${orderBy}&singleEvents=${singleEvents}`
        if (timeMax) path += `&timeMax=${encodeURIComponent(timeMax)}`

        const result = await calendarFetch(path)
        return makeResponse(id, result)
      }

      case 'create_event': {
        const summary = validateString(params.summary, 'summary')
        const description = validateOptionalString(params.description, 'description')
        const location = params.location as string | undefined
        const startTime = validateString(params.startTime, 'startTime')
        const endTime = validateString(params.endTime, 'endTime')
        const timeZone = (params.timeZone as string) ?? 'UTC'
        const attendees = Array.isArray(params.attendees) ? (params.attendees as Array<{ email: string }>) : []

        const event = {
          summary,
          description,
          location,
          start: { dateTime: startTime, timeZone },
          end: { dateTime: endTime, timeZone },
          attendees,
        }

        const result = await calendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events`, {
          method: 'POST',
          body: JSON.stringify(event),
        })
        return makeResponse(id, result)
      }

      case 'update_event': {
        const eventId = validateString(params.eventId, 'eventId')
        const summary = params.summary as string | undefined
        const description = params.description as string | undefined
        const location = params.location as string | undefined
        const startTime = params.startTime as string | undefined
        const endTime = params.endTime as string | undefined
        const timeZone = (params.timeZone as string) ?? 'UTC'

        const event: Record<string, unknown> = {}
        if (summary) event.summary = summary
        if (description !== undefined) event.description = description
        if (location !== undefined) event.location = location
        if (startTime) event.start = { dateTime: startTime, timeZone }
        if (endTime) event.end = { dateTime: endTime, timeZone }

        const result = await calendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
          method: 'PATCH',
          body: JSON.stringify(event),
        })
        return makeResponse(id, result)
      }

      case 'delete_event': {
        const eventId = validateString(params.eventId, 'eventId')
        await calendarFetch(`/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
          method: 'DELETE',
        })
        return makeResponse(id, { success: true, eventId })
      }

      case 'find_free_slots': {
        const timeMin = validateString(params.timeMin, 'timeMin')
        const timeMax = validateString(params.timeMax, 'timeMax')
        const durationMinutes = typeof params.durationMinutes === 'number' ? params.durationMinutes : 60

        const result = await calendarFetch('/freeBusy', {
          method: 'POST',
          body: JSON.stringify({
            timeMin,
            timeMax,
            items: [{ id: calendarId }],
          }),
        })

        const busyData = result as { calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }> }
        const busy = busyData.calendars?.[calendarId]?.busy ?? []

        busy.sort((a, b) => a.start.localeCompare(b.start))

        const freeSlots: Array<{ start: string; end: string; durationMinutes: number }> = []
        let currentStart = timeMin
        const minEnd = new Date(timeMax).getTime()

        for (const period of busy) {
          const busyStart = new Date(period.start).getTime()
          const busyEnd = new Date(period.end).getTime()

          if (busyStart > new Date(currentStart).getTime()) {
            const slotEnd = new Date(Math.min(busyStart, minEnd)).toISOString()
            const durationMs = new Date(slotEnd).getTime() - new Date(currentStart).getTime()
            if (durationMs >= durationMinutes * 60 * 1000) {
              freeSlots.push({
                start: currentStart,
                end: slotEnd,
                durationMinutes: Math.round(durationMs / 60000),
              })
            }
          }

          currentStart = new Date(Math.max(new Date(currentStart).getTime(), busyEnd)).toISOString()
        }

        if (new Date(currentStart).getTime() < minEnd) {
          const durationMs = minEnd - new Date(currentStart).getTime()
          if (durationMs >= durationMinutes * 60 * 1000) {
            freeSlots.push({
              start: currentStart,
              end: timeMax,
              durationMinutes: Math.round(durationMs / 60000),
            })
          }
        }

        return makeResponse(id, { freeSlots, total: freeSlots.length, timeMin, timeMax, minimumDurationMinutes: durationMinutes })
      }

      default:
        return makeResponse(id, undefined, makeError(-32601, `Method not found: ${method}`))
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const code = message.includes('not found') ? 404 : message.includes('not configured') ? 401 : message.includes('rate limit') ? 429 : 500
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

process.stderr.write(`[${SERVER_NAME}] Calendar MCP server started\n`)
process.stderr.write(`[${SERVER_NAME}] Google API configured: ${!!(GOOGLE_ACCESS_TOKEN || GOOGLE_API_KEY)}\n`)
