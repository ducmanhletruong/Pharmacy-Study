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
  const { DATABASE_URL: connectionString, DATABASE_CA_CERT: ca } = process.env
  if (!connectionString) throw new Error('DATABASE_URL is required')
  if (ca) {
    // node-postgres lets SSL parameters in the URL replace the explicit CA.
    const url = new URL(connectionString)
    for (const key of url.searchParams.keys()) {
      if (key.toLowerCase().startsWith('ssl'))
        throw new Error(
          'Remove SSL parameters from DATABASE_URL when DATABASE_CA_CERT is set',
        )
    }
  }
  pool ??= new pg.Pool({
    connectionString,
    max: readPoolMax(),
    ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
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

export async function withAccountRows<T>(
  userId: string,
  run: (client: pg.PoolClient) => Promise<T>,
  existing?: pg.PoolClient,
): Promise<T> {
  const client = existing ?? (await getPool().connect())
  try {
    await client.query(existing ? 'SAVEPOINT account_rows' : 'BEGIN')
    const previous = existing
      ? (
          await client.query<{ account: string | null }>(
            "SELECT current_setting('pharmacy.account_id', true) AS account",
          )
        ).rows[0]?.account
      : null
    await client.query("SELECT set_config('pharmacy.account_id', $1, true)", [
      userId.toLowerCase(),
    ])
    const result = await run(client)
    if (existing) {
      await client.query("SELECT set_config('pharmacy.account_id', $1, true)", [
        previous ?? '',
      ])
      await client.query('RELEASE SAVEPOINT account_rows')
    } else {
      await client.query('COMMIT')
    }
    return result
  } catch (error) {
    if (existing) {
      await client.query('ROLLBACK TO SAVEPOINT account_rows')
      await client.query('RELEASE SAVEPOINT account_rows')
    } else {
      await client.query('ROLLBACK')
    }
    throw error
  } finally {
    if (!existing) client.release()
  }
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
