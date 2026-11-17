import { spawnSync } from 'node:child_process'
import assert from 'node:assert/strict'

for (const mode of ['dev', 'test']) {
  const result = spawnSync(
    process.execPath,
    ['scripts/start.mjs', '--port', '3199'],
    {
      env: {
        ...process.env,
        NODE_ENV: 'production',
        AUTH_MODE: mode,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      encoding: 'utf8',
      timeout: 15000,
      killSignal: 'SIGKILL',
    },
  )
  assert.equal(
    result.error,
    undefined,
    'Guard must reject before waiting for Next startup',
  )
  assert.notEqual(result.status, 0)
  assert.match(
    result.stdout + result.stderr,
    new RegExp(`AUTH_MODE=${mode} is forbidden in production`),
  )
  console.log(`PASS: production startup rejected AUTH_MODE=${mode}`)
}
