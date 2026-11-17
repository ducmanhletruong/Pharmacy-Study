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

export async function assertRuntimeDatabase() {
  const result = await getPool().query<{
    rolsuper: boolean
    rolcreatedb: boolean
    rolcreaterole: boolean
    rolreplication: boolean
    rolbypassrls: boolean
    app: boolean
    migration: boolean
  }>(
    "SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,pg_has_role(session_user,'app_rw','MEMBER') app,pg_has_role(session_user,'migrator','MEMBER') migration FROM pg_roles WHERE rolname=session_user",
  )
  const role = result.rows[0]
  if (
    !role ||
    !role.app ||
    role.migration ||
    role.rolsuper ||
    role.rolcreatedb ||
    role.rolcreaterole ||
    role.rolreplication ||
    role.rolbypassrls
  )
    throw new Error(
      'Runtime database must use an unprivileged app_rw login, not migrator/bootstrap',
    )
}
