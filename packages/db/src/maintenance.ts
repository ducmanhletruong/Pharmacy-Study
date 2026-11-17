import pg from 'pg'
import { loadLocalEnv } from './env'

export function loadMaintenanceEnv() {
  try {
    process.loadEnvFile(new URL('../../../.env.db', import.meta.url))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  loadLocalEnv()
}
let pool: pg.Pool | undefined
export function getMaintenancePool() {
  const connectionString =
    process.env.MIGRATION_DATABASE_URL ||
    process.env.BOOTSTRAP_DATABASE_URL ||
    process.env.DATABASE_URL
  if (!connectionString) throw new Error('Migration credentials are required')
  return (pool ??= new pg.Pool({ connectionString, max: 3 }))
}
export async function closeMaintenance() {
  await pool?.end()
  pool = undefined
}
