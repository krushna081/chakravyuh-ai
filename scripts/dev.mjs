#!/usr/bin/env node

const CLEAR = '\x1Bc'
const RESET = '\x1B[0m'
const BOLD = '\x1B[1m'
const DIM = '\x1B[2m'
const CYAN = '\x1B[36m'
const GREEN = '\x1B[32m'
const YELLOW = '\x1B[33m'
const MAGENTA = '\x1B[35m'

const SEP = `${DIM}${'━'.repeat(56)}${RESET}`

function log(tag, msg) {
  const ts = new Date().toLocaleTimeString()
  process.stdout.write(`${DIM}[${ts}]${RESET} ${tag} ${msg}\n`)
}

function header() {
  process.stdout.write(CLEAR)
  process.stdout.write(`${CYAN}${BOLD}`)
  process.stdout.write(`  ⚔  Chakravyuh AI  —  Development Mode\n`)
  process.stdout.write(`  ${'v0.1.0-alpha'}${RESET}\n`)
  process.stdout.write(`  ${SEP}\n\n`)
}

header()

log(`${GREEN}${BOLD}START${RESET}`, `${BOLD}Node.js${RESET} ${DIM}${process.version}${RESET}`)
log(`${GREEN}${BOLD}START${RESET}`, `Environment: ${BOLD}development${RESET}`)
log(`${GREEN}${BOLD}START${RESET}`, `Watch mode:  ${BOLD}enabled${RESET}`)
log(`${GREEN}${BOLD}START${RESET}`, `Entry:       ${DIM}backend/src/index.ts${RESET}`)
process.stdout.write('\n')

process.env.NODE_ENV = 'development'

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const entry = resolve(__dirname, '..', 'backend', 'src', 'index.ts')

const proc = spawn('node', ['--watch', entry], {
  stdio: ['inherit', 'inherit', 'inherit'],
  env: { ...process.env, NODE_ENV: 'development' },
  shell: true,
})

proc.on('error', (err) => {
  log(`${YELLOW}${BOLD}WARN${RESET}`, `Failed to start: ${err.message}`)
  log(`${YELLOW}${BOLD}WARN${RESET}`, 'Make sure the backend entry file exists and tsconfig is configured.\n')
  process.exit(1)
})

proc.on('exit', (code) => {
  process.stdout.write(`\n${SEP}\n`)
  log(`${MAGENTA}${BOLD}EXIT${RESET}`, `Process exited with code ${code ?? 'signal'}\n`)
  process.exit(code ?? 0)
})

process.on('SIGINT', () => proc.kill('SIGINT'))
process.on('SIGTERM', () => proc.kill('SIGTERM'))
