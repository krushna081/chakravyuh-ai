/**
 * Custom Agent Example
 *
 * Demonstrates how to create and register a custom agent.
 * Run: node examples/custom-agent.mjs
 */

class CustomAgent {
  constructor(config) {
    this.id = config.id
    this.name = config.name
    this.tools = config.tools || []
  }

  async handleMessage(message) {
    console.log(`[${this.name}] Received:`, message.payload.task)

    // Custom logic here
    const result = `Processed by ${this.name}: ${message.payload.task}`

    return {
      type: 'response',
      from: this.id,
      to: message.from,
      payload: { data: result },
    }
  }
}

// Registration payload
const agentDefinition = {
  id: 'my-custom-agent',
  name: 'My Custom Agent',
  role: 'Custom task processing',
  provider: 'openai',
  model: 'gpt-4o-mini',
  tools: ['filesystem'],
  memoryScope: ['working'],
  allowedPeers: ['coordinator'],
  limits: {
    maxTokensPerTask: 2048,
    maxConsecutiveCalls: 10,
    timeout: 30000,
  },
}

export { CustomAgent, agentDefinition }
