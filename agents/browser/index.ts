import { BaseAgent } from '../base'
import type { AgentMessage } from '@chakravyuh/core'
import { AgentError, TimeoutError } from '@chakravyuh/core/errors'

interface BrowserSession {
  id: string
  currentUrl: string
  startTime: string
  steps: BrowserAction[]
  status: 'active' | 'closed' | 'error'
}

interface BrowserAction {
  type: 'navigate' | 'click' | 'fill' | 'screenshot' | 'extract' | 'scroll' | 'wait' | 'evaluate'
  target?: string
  value?: string
  selector?: string
  result?: unknown
  timestamp: string
  durationMs: number
}

interface PageInfo {
  url: string
  title: string
  content?: string
  screenshot?: string
  links: Array<{ text: string; href: string }>
  metadata: Record<string, string>
}

export class BrowserAgent extends BaseAgent {
  private sessions = new Map<string, BrowserSession>()
  private activeSessionId: string | null = null

  async onStart(): Promise<void> {
    this.logger.info('Browser agent ready')
  }

  async onStop(): Promise<void> {
    for (const [id, session] of this.sessions) {
      if (session.status === 'active') {
        this.logger.info('Closing browser session on stop', { sessionId: id })
      }
    }
    this.sessions.clear()
    this.activeSessionId = null
  }

  async onMessage(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const context = message.payload.context ?? {}

    const normalized = task.toLowerCase()

    if (/\b(navigate|go\s+to|open\s+url|visit|browse\s+to)\b/.test(normalized)) {
      return this.handleNavigate(message)
    }

    if (/\b(click|press|tap)\b/.test(normalized) && /\b(button|link|element)\b/.test(normalized)) {
      return this.handleClick(message)
    }

    if (/\b(fill|type|enter|input)\b/.test(normalized) && /\b(text|value|form|field)\b/.test(normalized)) {
      return this.handleFill(message)
    }

    if (/\b(screenshot|capture|snapshot)\b/.test(normalized)) {
      return this.handleScreenshot(message)
    }

    if (/\b(extract|get\s+content|read\s+page|scrape|parse)\b/.test(normalized)) {
      return this.handleExtractContent(message)
    }

    if (/\b(scroll|scroll\s+down|scroll\s+up)\b/.test(normalized)) {
      return this.handleScroll(message)
    }

    if (/\b(session|start\s+browser|new\s+tab|close)\b/.test(normalized)) {
      return this.handleSession(message)
    }

    if (/\b(form|submit|login|search)\b/.test(normalized)) {
      return this.handleFormInteraction(message)
    }

    return this.handleGenericBrowse(message)
  }

  async onError(error: Error, message: AgentMessage): Promise<void> {
    this.logger.error('Browser error', { error: error.message, taskId: message.id })

    if (this.activeSessionId) {
      const session = this.sessions.get(this.activeSessionId)
      if (session) {
        session.status = 'error'
      }
    }
  }

  private async handleNavigate(message: AgentMessage): Promise<AgentMessage> {
    const url = this.extractUrl(message.payload.task ?? '')
    if (!url) {
      return this.reply(message, { data: { error: 'No URL provided for navigation' } })
    }

    const session = this.getOrCreateSession()
    const action: BrowserAction = {
      type: 'navigate',
      target: url,
      timestamp: new Date().toISOString(),
      durationMs: 0,
    }

    const startTime = Date.now()
    try {
      const pageInfo = await this.callTool('browser', { action: 'navigate', url }) as PageInfo
      action.durationMs = Date.now() - startTime
      action.result = { status: 'success', title: pageInfo.title }
      session.currentUrl = pageInfo.url
      session.steps.push(action)

      return this.reply(message, {
        data: {
          url: pageInfo.url,
          title: pageInfo.title,
          links: pageInfo.links.slice(0, 20),
          metadata: pageInfo.metadata,
        },
      })
    } catch (error) {
      action.durationMs = Date.now() - startTime
      action.result = { status: 'error', error: (error as Error).message }
      session.steps.push(action)

      throw new AgentError(`Navigation failed: ${(error as Error).message}`, { url })
    }
  }

  private async handleClick(message: AgentMessage): Promise<AgentMessage> {
    const selector = this.extractSelector(message.payload.task ?? '')
    if (!selector) {
      return this.reply(message, { data: { error: 'No selector provided for click' } })
    }

    const session = this.getOrCreateSession()
    const action: BrowserAction = {
      type: 'click',
      selector,
      timestamp: new Date().toISOString(),
      durationMs: 0,
    }

    const startTime = Date.now()
    try {
      const result = await this.callTool('browser', { action: 'click', selector })
      action.durationMs = Date.now() - startTime
      action.result = result
      session.steps.push(action)

      return this.reply(message, { data: { clicked: selector, result } })
    } catch (error) {
      action.durationMs = Date.now() - startTime
      action.result = { status: 'error', error: (error as Error).message }
      session.steps.push(action)
      throw new AgentError(`Click failed: ${(error as Error).message}`, { selector })
    }
  }

  private async handleFill(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const selector = this.extractSelector(task)
    const value = this.extractValue(task)

    if (!selector || !value) {
      return this.reply(message, { data: { error: 'Both selector and value required for fill' } })
    }

    const session = this.getOrCreateSession()
    const action: BrowserAction = {
      type: 'fill',
      selector,
      value,
      timestamp: new Date().toISOString(),
      durationMs: 0,
    }

    const startTime = Date.now()
    try {
      const result = await this.callTool('browser', { action: 'fill', selector, value })
      action.durationMs = Date.now() - startTime
      action.result = result
      session.steps.push(action)

      return this.reply(message, { data: { filled: selector, with: value } })
    } catch (error) {
      action.durationMs = Date.now() - startTime
      action.result = { status: 'error', error: (error as Error).message }
      session.steps.push(action)
      throw new AgentError(`Fill failed: ${(error as Error).message}`, { selector })
    }
  }

  private async handleScreenshot(message: AgentMessage): Promise<AgentMessage> {
    const session = this.getOrCreateSession()

    const action: BrowserAction = {
      type: 'screenshot',
      timestamp: new Date().toISOString(),
      durationMs: 0,
    }

    const startTime = Date.now()
    try {
      const screenshot = await this.callTool('browser', { action: 'screenshot' })
      action.durationMs = Date.now() - startTime
      action.result = { status: 'success', size: (screenshot as string).length }
      session.steps.push(action)

      return this.reply(message, { data: { screenshot, url: session.currentUrl } })
    } catch (error) {
      action.durationMs = Date.now() - startTime
      action.result = { status: 'error', error: (error as Error).message }
      session.steps.push(action)
      throw new AgentError(`Screenshot failed: ${(error as Error).message}`)
    }
  }

  private async handleExtractContent(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const url = this.extractUrl(task) ?? this.activeSession
      ? this.sessions.get(this.activeSessionId)?.currentUrl
      : null

    if (url) {
      try {
        const content = await this.callTool('web-fetch', { url, format: 'markdown' })
        const text = content as string

        const pageInfo: PageInfo = {
          url,
          title: this.extractTitle(text),
          content: text.slice(0, 10000),
          links: [],
          metadata: {},
        }

        return this.reply(message, { data: pageInfo })
      } catch (error) {
        return this.reply(message, { data: { error: `Extraction failed: ${(error as Error).message}` } })
      }
    }

    if (this.activeSessionId) {
      const action: BrowserAction = {
        type: 'extract',
        timestamp: new Date().toISOString(),
        durationMs: 0,
      }

      const startTime = Date.now()
      try {
        const content = await this.callTool('browser', { action: 'extract', selector: 'body' })
        action.durationMs = Date.now() - startTime
        action.result = { status: 'success' }
        const session = this.sessions.get(this.activeSessionId)
        if (session) session.steps.push(action)

        return this.reply(message, { data: { content: (content as string).slice(0, 10000) } })
      } catch (error) {
        return this.reply(message, { data: { error: `Extraction failed: ${(error as Error).message}` } })
      }
    }

    return this.reply(message, { data: { error: 'No URL or active session to extract from' } })
  }

  private async handleScroll(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''
    const direction = /scroll\s+up/i.test(task) ? 'up' : 'down'
    const amount = this.extractNumber(task) ?? 500

    const session = this.getOrCreateSession()
    const action: BrowserAction = {
      type: 'scroll',
      target: direction,
      value: String(amount),
      timestamp: new Date().toISOString(),
      durationMs: 0,
    }

    const startTime = Date.now()
    try {
      const result = await this.callTool('browser', { action: 'scroll', direction, amount })
      action.durationMs = Date.now() - startTime
      action.result = result
      session.steps.push(action)

      return this.reply(message, { data: { scrolled: direction, amount } })
    } catch (error) {
      action.durationMs = Date.now() - startTime
      action.result = { status: 'error', error: (error as Error).message }
      session.steps.push(action)
      throw new AgentError(`Scroll failed: ${(error as Error).message}`)
    }
  }

  private async handleSession(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''

    if (/close/i.test(task) && this.activeSessionId) {
      const session = this.sessions.get(this.activeSessionId)
      if (session) {
        session.status = 'closed'
      }
      this.activeSessionId = null
      return this.reply(message, { data: { status: 'session_closed' } })
    }

    const session = this.createNewSession()
    return this.reply(message, {
      data: {
        sessionId: session.id,
        status: 'active',
        steps: session.steps.length,
      },
    })
  }

  private async handleFormInteraction(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''

    const fields = this.extractFormFields(task)
    if (fields.length === 0) {
      const submitSelector = this.extractSelector(task)
      if (submitSelector) {
        return this.handleClick(message)
      }
      return this.reply(message, { data: { error: 'No form fields or submit button identified' } })
    }

    const session = this.getOrCreateSession()
    for (const field of fields) {
      const action: BrowserAction = {
        type: 'fill',
        selector: field.selector,
        value: field.value,
        timestamp: new Date().toISOString(),
        durationMs: 0,
      }

      const startTime = Date.now()
      try {
        await this.callTool('browser', { action: 'fill', selector: field.selector, value: field.value })
        action.durationMs = Date.now() - startTime
        session.steps.push(action)
      } catch {
        this.logger.warn('Failed to fill field', { selector: field.selector })
      }
    }

    const submitBtn = this.extractSelector(task) ?? 'button[type="submit"]'
    try {
      await this.callTool('browser', { action: 'click', selector: submitBtn })
      session.steps.push({ type: 'click', selector: submitBtn, timestamp: new Date().toISOString(), durationMs: 0 })
    } catch {
      this.logger.warn('Failed to click submit', { selector: submitBtn })
    }

    return this.reply(message, { data: { fieldsFilled: fields.length, submitted: true } })
  }

  private async handleGenericBrowse(message: AgentMessage): Promise<AgentMessage> {
    const task = message.payload.task ?? ''

    const url = this.extractUrl(task)
    if (url) {
      return this.handleNavigate({ ...message, payload: { ...message.payload, task: `Navigate to ${url}` } })
    }

    const searchQuery = task.replace(/\b(browse|search\s+for|find|look\s+for|get)\b/gi, '').trim()
    if (searchQuery) {
      const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`
      return this.handleNavigate({ ...message, payload: { ...message.payload, task: `Navigate to ${searchUrl}` } })
    }

    return this.reply(message, { data: { error: 'Could not interpret browsing task' } })
  }

  private getOrCreateSession(): BrowserSession {
    if (this.activeSessionId) {
      const session = this.sessions.get(this.activeSessionId)
      if (session && session.status === 'active') return session
    }
    return this.createNewSession()
  }

  private createNewSession(): BrowserSession {
    const session: BrowserSession = {
      id: `browser-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      currentUrl: '',
      startTime: new Date().toISOString(),
      steps: [],
      status: 'active',
    }
    this.sessions.set(session.id, session)
    this.activeSessionId = session.id
    return session
  }

  private extractUrl(task: string): string | null {
    const urlPattern = /https?:\/\/[^\s,;)]+/i
    const match = task.match(urlPattern)
    if (match) return match[0]

    const domainPattern = /\b(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s,;)]*)?\b/i
    const domainMatch = task.match(domainPattern)
    if (domainMatch) {
      const domain = domainMatch[0]
      return domain.startsWith('http') ? domain : `https://${domain}`
    }

    return null
  }

  private extractSelector(task: string): string | null {
    const patterns = [
      /(?:selector|element|on)\s*[`'"]?(#[a-zA-Z][\w-]*|\.[a-zA-Z][\w-]*|[a-zA-Z][\w-]*(?:\[[^\]]+\])?)[`'"]?/i,
      /(?:click|press|fill|type)\s+(?:the\s+)?(?:button|link|element|field|input)\s*[`'"]?(.+?)[`'"]?\s*(?:with|button|link|element)?$/i,
      /button\s*[`'"]?(.+?)[`'"]?\s*$/i,
    ]

    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match?.[1]) return match[1].trim()
    }

    if (/submit/i.test(task)) return 'button[type="submit"]'
    if (/login/i.test(task)) return 'button[type="submit"]'

    return null
  }

  private extractValue(task: string): string | null {
    const patterns = [
      /(?:with|value|text)\s*[`'"]?(.+?)[`'"]?\s*(?:in|into|on|at)?\s*$/i,
      /(?:fill|type|enter)\s+(?:in|into|the\s+)?[`'"]?(.+?)[`'"]?\s*(?:in|into|field|input|box)?\s*$/i,
    ]

    for (const pattern of patterns) {
      const match = task.match(pattern)
      if (match?.[1]) return match[1].trim()
    }

    return null
  }

  private extractNumber(task: string): number | null {
    const match = task.match(/(\d+)\s*(px|pixels)?/i)
    return match ? parseInt(match[1]!, 10) : null
  }

  private extractFormFields(task: string): Array<{ selector: string; value: string }> {
    const fields: Array<{ selector: string; value: string }> = []

    const fieldPattern = /(?:field|input|box)\s*[`'"]?(#[a-zA-Z][\w-]*|\.[a-zA-Z][\w-]*|[a-zA-Z][\w-]*)[`'"]?\s*(?:with|value|:|=)\s*[`'"]?(.+?)[`'"]?(?:\s+(?:and|,|$))/gi
    let match
    while ((match = fieldPattern.exec(task)) !== null) {
      fields.push({ selector: match[1]!, value: match[2]! })
    }

    if (fields.length === 0) {
      const usernameFields = /(username|email|name)/i.test(task) ? [{ selector: '#username', value: this.extractValue(task) ?? '' }] : []
      const passwordFields = /password/i.test(task) ? [{ selector: '#password', value: this.extractValue(task) ?? '' }] : []
      fields.push(...usernameFields, ...passwordFields)
    }

    return fields
  }

  private extractTitle(text: string): string {
    const match = text.match(/#\s+(.+)/)
    return match?.[1] ?? ''
  }

  private get activeSession(): BrowserSession | null {
    if (!this.activeSessionId) return null
    return this.sessions.get(this.activeSessionId) ?? null
  }
}
