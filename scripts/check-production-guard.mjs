import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'

const child = spawn(process.execPath, ['scripts/start.mjs', '--port', '3199'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    AUTH_MODE: 'dev',
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
child.stdout.on('data', (chunk) => {
  output += chunk
})
child.stderr.on('data', (chunk) => {
  output += chunk
})
const timer = setTimeout(() => {
  child.kill()
  process.exitCode = 1
  console.error('Production guard did not reject dev mode in time')
}, 15000)
child.on('error', (error) => {
  clearTimeout(timer)
  throw error
})
child.on('exit', (code) => {
  clearTimeout(timer)
  assert.notEqual(code, 0, 'Production must reject dev mode')
  assert.match(output, /AUTH_MODE=dev is forbidden in production/)
  console.log('PASS: production startup rejected AUTH_MODE=dev')
})
