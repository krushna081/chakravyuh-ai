import { EventEmitter } from 'node:events'
import { logger } from '../logger.js'

export enum LifecycleState {
  Created = 'created',
  Starting = 'starting',
  Running = 'running',
  Stopping = 'stopping',
  Stopped = 'stopped',
  Error = 'error',
}

const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  [LifecycleState.Created]: [LifecycleState.Starting],
  [LifecycleState.Starting]: [LifecycleState.Running, LifecycleState.Error],
  [LifecycleState.Running]: [LifecycleState.Stopping, LifecycleState.Error],
  [LifecycleState.Stopping]: [LifecycleState.Stopped, LifecycleState.Error],
  [LifecycleState.Stopped]: [LifecycleState.Starting],
  [LifecycleState.Error]: [LifecycleState.Starting, LifecycleState.Stopping],
}

export interface LifecycleEvent {
  from: LifecycleState
  to: LifecycleState
  timestamp: string
}

export class LifecycleManager {
  private _state: LifecycleState = LifecycleState.Created
  private _startedAt: string | null = null
  private _error: Error | null = null
  private emitter = new EventEmitter()
  private transitionCount = 0

  get state(): LifecycleState {
    return this._state
  }

  get startedAt(): string | null {
    return this._startedAt
  }

  get error(): Error | null {
    return this._error
  }

  get uptime(): number {
    if (!this._startedAt) return 0
    return Date.now() - new Date(this._startedAt).getTime()
  }

  transition(to: LifecycleState): void {
    const from = this._state
    const allowed = VALID_TRANSITIONS[from]

    if (!allowed.includes(to)) {
      const msg = `Invalid lifecycle transition: ${from} -> ${to}`
      logger.error(msg, { source: 'LifecycleManager' })
      throw new Error(msg)
    }

    this._state = to
    this.transitionCount++

    if (to === LifecycleState.Running) {
      this._startedAt = new Date().toISOString()
      this._error = null
    }

    if (to === LifecycleState.Error) {
      this._error = new Error(`Transition to error state at ${new Date().toISOString()}`)
    }

    if (to === LifecycleState.Stopped) {
      this._startedAt = null
    }

    const event: LifecycleEvent = { from, to, timestamp: new Date().toISOString() }
    this.emitter.emit('transition', event)

    logger.info(`Lifecycle: ${from} -> ${to}`, { source: 'LifecycleManager' })
  }

  onTransition(handler: (event: LifecycleEvent) => void): () => void {
    this.emitter.on('transition', handler)
    return () => { this.emitter.off('transition', handler) }
  }

  reset(): void {
    this._state = LifecycleState.Created
    this._startedAt = null
    this._error = null
    this.transitionCount = 0
  }

  isRunning(): boolean {
    return this._state === LifecycleState.Running
  }

  isStarting(): boolean {
    return this._state === LifecycleState.Starting
  }

  isStopping(): boolean {
    return this._state === LifecycleState.Stopping
  }

  isStopped(): boolean {
    return this._state === LifecycleState.Stopped
  }

  isError(): boolean {
    return this._state === LifecycleState.Error
  }

  canStart(): boolean {
    return VALID_TRANSITIONS[this._state].includes(LifecycleState.Starting)
  }
}
