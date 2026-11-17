import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

export const DEV_USER_ID = '00000000-0000-4000-8000-000000000001'
// Lazy: importing a route or building must not create a connection.
let pool: pg.Pool | undefined
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  pool ??= new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
  return pool
}
export function getDb() {
  return drizzle(getPool())
}
export async function closeDb() {
  await pool?.end()
  pool = undefined
}
