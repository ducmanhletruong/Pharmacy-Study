import { assertAuthMode, readAuthConfig } from './config'
export async function register() {
  assertAuthMode()
  const config = readAuthConfig()
  if (
    (config.AUTH_MODE === 'oidc' || config.AUTH_MODE === 'test') &&
    process.env.NEXT_RUNTIME === 'nodejs'
  ) {
    await (await import('@pharmacy/db')).assertRuntimeDatabase()
  }
}
