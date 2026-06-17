/**
 * Workflow Example
 *
 * Executes a multi-step workflow via the Chakravyuh API.
 * Run: node examples/workflow.mjs
 */

const API_BASE = 'http://localhost:3000/api/v1'

const workflow = {
  id: 'example-research-workflow',
  version: '1.0',
  description: 'Research a topic, summarize findings, and save to file',
  steps: [
    {
      id: 'research',
      agent: 'researcher',
      task: 'Research the latest developments in AI agent frameworks',
    },
    {
      id: 'summarize',
      agent: 'planner',
      task: 'Summarize the research findings concisely',
      depends_on: ['research'],
    },
    {
      id: 'save',
      agent: 'coder',
      task: 'Save the summary to workspace/research-summary.md',
      depends_on: ['summarize'],
    },
  ],
}

async function main() {
  const response = await fetch(`${API_BASE}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  })

  if (!response.ok) {
    console.error('Error:', response.status, await response.text())
    process.exit(1)
  }

  const result = await response.json()
  console.log('Workflow ID:', result.id)
  console.log('Status:', result.status)
  console.log('Results:', JSON.stringify(result.steps, null, 2))
}

main().catch(console.error)
