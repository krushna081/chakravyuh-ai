/**
 * Basic Chat Example
 *
 * Sends a message to a Chakravyuh agent and prints the response.
 * Run: node examples/basic-chat.mjs
 */

const API_BASE = 'http://localhost:3000/api/v1'

async function main() {
  const response = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      agent: 'coordinator',
      message: 'What is the capital of France?',
      stream: false,
    }),
  })

  if (!response.ok) {
    console.error('Error:', response.status, await response.text())
    process.exit(1)
  }

  const result = await response.json()
  console.log('Agent:', result.agent)
  console.log('Response:', result.content)
}

main().catch(console.error)
