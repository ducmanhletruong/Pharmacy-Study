import { loadMaintenanceEnv } from './maintenance'
import { provisionLocal } from './provision-local'
loadMaintenanceEnv()
try {
  if (!process.argv.includes('--write-local-env'))
    throw new Error('Explicit local env flag required')
  const bootstrap =
    process.env.BOOTSTRAP_DATABASE_URL || process.env.DATABASE_URL
  if (!bootstrap) throw new Error('Bootstrap URL required')
  await provisionLocal({
    bootstrap,
    runtimePrevious: process.env.DATABASE_URL,
    migrationPrevious: process.env.MIGRATION_DATABASE_URL,
  })
  console.log(
    'Local app/migration roles ready; private env files updated without printing credentials.',
  )
} catch (error) {
  console.error(
    `Provisioning failed (${(error as NodeJS.ErrnoException).code ?? 'configuration'}); inspect private configuration/journal; confirm no CLI is active before removing a stale .env.provision.lock directory.`,
  )
  process.exitCode = 1
}
