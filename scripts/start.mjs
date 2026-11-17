import { runtimeEnvironment } from './runtime-env.mjs'
import { readAuthConfig } from '../apps/web/src/config.ts'
import { assertRuntimeDatabase, closeDb } from '../packages/db/src/client.ts'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { assertAuthMode } from '../apps/web/src/config.ts'

// Reject before Next opens a port, even if its instrumentation hook leaves
// background handles alive after a failed startup. Do not load dev .env here.
const runtimeEnv = runtimeEnvironment(process.env)
assertAuthMode({ ...runtimeEnv, NODE_ENV: 'production' })
const config = readAuthConfig({ ...process.env, NODE_ENV: 'production' })
if (config.AUTH_MODE === 'oidc') {
  await assertRuntimeDatabase()
  await closeDb()
}
const child = spawn(
  process.execPath,
  [
    fileURLToPath(
      new URL('../apps/web/node_modules/next/dist/bin/next', import.meta.url),
    ),
    'start',
    '--hostname',
    '0.0.0.0',
    '--port',
    String(config.PORT),
    ...process.argv.slice(2),
  ],
  {
    cwd: new URL('../apps/web/', import.meta.url),
    env: { ...runtimeEnv, NODE_ENV: 'production' },
    stdio: 'inherit',
  },
)
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => child.kill(signal))
child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})
child.on('exit', (code) => {
  process.exitCode = code ?? 1
})
