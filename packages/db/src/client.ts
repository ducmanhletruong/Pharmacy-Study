import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'

export const DEV_USER_ID = '00000000-0000-4000-8000-000000000001'

const operationalErrorCodes = new Set([
  '08000',
  '08001',
  '08003',
  '08004',
  '08006',
  '08P01',
  '28000',
  '28P01',
  '40001',
  '40P01',
  '53300',
  '57014',
  '57P01',
  '57P02',
  '57P03',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EPIPE',
  'ETIMEDOUT',
])

export function errorLogFields(error: unknown) {
  const type =
    error instanceof pg.DatabaseError
      ? 'DatabaseError'
      : error instanceof TypeError
        ? 'TypeError'
        : error instanceof Error
          ? 'Error'
          : 'UnknownError'
  const code =
    error instanceof Error
      ? Object.getOwnPropertyDescriptor(error, 'code')?.value
      : undefined
  return {
    errorType: type,
    ...(typeof code === 'string' && operationalErrorCodes.has(code)
      ? { causeCode: code }
      : {}),
  }
}

export function readPoolMax(
  env: Record<string, string | undefined> = process.env,
) {
  const value = Number(env.DB_POOL_MAX ?? 5)
  if (!Number.isInteger(value) || value < 1 || value > 100)
    throw new Error('DB_POOL_MAX must be an integer from 1 to 100')
  return value
}
// Lazy: importing a route or building must not create a connection.
let pool: pg.Pool | undefined
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required')
  pool ??= new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    max: readPoolMax(),
  }).on('error', (error) => {
    console.error(
      JSON.stringify({ event: 'db.pool.error', ...errorLogFields(error) }),
    )
  })
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
