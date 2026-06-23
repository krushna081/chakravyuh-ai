export class ChakravyuhError extends Error {
  public readonly code: string
  public readonly details?: unknown

  constructor(message: string, code = 'CHAKRAVYUH_INTERNAL_ERROR', details?: unknown) {
    super(message)
    this.name = 'ChakravyuhError'
    this.code = code
    this.details = details
  }
}

export class ProviderError extends ChakravyuhError {
  constructor(message: string, details?: unknown) {
    super(message, 'PROVIDER_ERROR', details)
    this.name = 'ProviderError'
  }
}

export class AgentError extends ChakravyuhError {
  constructor(message: string, details?: unknown) {
    super(message, 'AGENT_ERROR', details)
    this.name = 'AgentError'
  }
}

export class MCPError extends ChakravyuhError {
  constructor(message: string, details?: unknown) {
    super(message, 'MCP_ERROR', details)
    this.name = 'MCPError'
  }
}

export class ConfigError extends ChakravyuhError {
  constructor(message: string, details?: unknown) {
    super(message, 'CONFIG_ERROR', details)
    this.name = 'ConfigError'
  }
}

export class ValidationError extends ChakravyuhError {
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class TimeoutError extends ChakravyuhError {
  constructor(message = 'Operation timed out', details?: unknown) {
    super(message, 'TIMEOUT_ERROR', details)
    this.name = 'TimeoutError'
  }
}
