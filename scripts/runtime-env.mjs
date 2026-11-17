export function runtimeEnvironment(env) {
  const result = { ...env }
  for (const key of [
    'BOOTSTRAP_DATABASE_URL',
    'MIGRATION_DATABASE_URL',
    'POSTGRES_PASSWORD',
    'APP_DATABASE_PASSWORD',
    'MIGRATOR_DATABASE_PASSWORD',
  ])
    delete result[key]
  return result
}
