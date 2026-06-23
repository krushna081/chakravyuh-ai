import { Engine, WorkflowDefinition, Scheduler } from '@chakravyuh/core'

const workflow = new WorkflowDefinition({
  id: 'example-research-workflow',
  description: 'Research a topic, summarize findings, and save to file',
  steps: [
    { id: 'research', agent: 'researcher', task: 'Research the latest developments in AI agent frameworks' },
    { id: 'summarize', agent: 'planner', task: 'Summarize the research findings concisely', dependsOn: ['research'] },
    { id: 'save', agent: 'coder', task: 'Save the summary to workspace/research-summary.md', dependsOn: ['summarize'] },
  ],
})

async function main() {
  const config = { backend: 'openai', model: 'gpt-4o-mini' }
  const engine = new Engine(config)
  await engine.start()

  const scheduler = new Scheduler(engine)
  const result = await scheduler.execute(workflow)

  console.log('Workflow ID:', result.id)
  console.log('Status:', result.status)
  console.log('Results:', JSON.stringify(result.steps, null, 2))

  await engine.shutdown()
}

main().catch(console.error)
