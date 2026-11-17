import { runtimeEnvironment } from './runtime-env.mjs'
import { readAuthConfig } from '../apps/web/src/config.ts'
import { assertRuntimeDatabase, closeDb } from '../packages/db/src/client.ts'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
const config = readAuthConfig()
if (config.AUTH_MODE === 'oidc' || config.AUTH_MODE === 'test') {
  await assertRuntimeDatabase()
  await closeDb()
}
const runtimeEnv = runtimeEnvironment(process.env)
const child = spawn(
  process.execPath,
  [
    fileURLToPath(
      new URL('../apps/web/node_modules/next/dist/bin/next', import.meta.url),
    ),
    'dev',
    '--hostname',
    '0.0.0.0',
    '--port',
    String(config.PORT),
  ],
  {
    cwd: new URL('../apps/web/', import.meta.url),
    env: runtimeEnv,
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
