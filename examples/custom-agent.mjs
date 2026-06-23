import { BaseAgent, Engine } from '@chakravyuh/core'

class MyCustomAgent extends BaseAgent {
  constructor(config) {
    super(config)
    this.id = config.id ?? 'my-custom-agent'
    this.name = config.name ?? 'My Custom Agent'
    this.role = config.role ?? 'Custom task processing'
  }

  async handle(message) {
    console.log(`[${this.name}] Received:`, message.payload?.task ?? message.content)
    const result = `Processed by ${this.name}: ${message.payload?.task ?? message.content}`
    return { type: 'response', from: this.id, to: message.from, payload: { data: result } }
  }
}

async function main() {
  const config = { backend: 'openai', model: 'gpt-4o-mini' }
  const engine = new Engine(config)
  await engine.start()

  const agent = new MyCustomAgent({ name: 'Analyzer', role: 'text analysis' })
  engine.registerAgent(agent)

  const response = await engine.send(agent.id, { task: 'Summarize the meeting notes' })
  console.log(response)

  await engine.shutdown()
}

main().catch(console.error)
