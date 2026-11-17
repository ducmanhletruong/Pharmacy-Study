import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

try {
  process.loadEnvFile(new URL('../.env', import.meta.url))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}
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
    '3000',
  ],
  {
    cwd: new URL('../apps/web/', import.meta.url),
    env: process.env,
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
