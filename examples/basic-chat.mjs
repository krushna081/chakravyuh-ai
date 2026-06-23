import { Engine, ConfigManager } from '@chakravyuh/core'

async function main() {
  const config = await ConfigManager.load({
    backend: 'openai',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
  })

  const engine = new Engine(config)
  await engine.start()

  const response = await engine.chat({
    agent: 'coordinator',
    message: 'What is the capital of France?',
  })

  console.log('Agent:', response.agent)
  console.log('Response:', response.content)

  await engine.shutdown()
}

main().catch(console.error)
