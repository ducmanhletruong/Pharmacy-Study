import { assertAuthMode, readAuthConfig } from './config'
export async function register() {
  assertAuthMode()
  const config = readAuthConfig()
  if (
    ['oidc', 'test', 'guest'].includes(config.AUTH_MODE) &&
    process.env.NEXT_RUNTIME === 'nodejs'
  ) {
    await (await import('@pharmacy/db')).assertRuntimeDatabase()
  }
}
