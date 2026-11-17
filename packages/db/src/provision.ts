import { randomBytes } from 'node:crypto'
import { readFile, writeFile, chmod } from 'node:fs/promises'
import pg from 'pg'
import { loadMaintenanceEnv } from './maintenance'

loadMaintenanceEnv()
if (!process.argv.includes('--write-local-env'))
  throw new Error('Use --write-local-env only for your local project database')
const bootstrap = process.env.BOOTSTRAP_DATABASE_URL || process.env.DATABASE_URL
if (!bootstrap) throw new Error('Bootstrap database URL is required')
function databaseUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    throw new Error('Invalid private database URL configuration')
  }
}
const base = databaseUrl(bootstrap)
if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
  throw new Error(
    'Local provisioning only; provision hosted roles with your database operator',
  )
const admin = new pg.Pool({ connectionString: bootstrap, max: 1 })
const runtime = new URL(base),
  maintenance = new URL(base)
const roles = [
  {
    name: 'pharmacy_app',
    group: 'app_rw',
    url: runtime,
    previous: process.env.DATABASE_URL,
  },
  {
    name: 'pharmacy_migrator',
    group: 'migrator',
    url: maintenance,
    previous: process.env.MIGRATION_DATABASE_URL,
  },
]
try {
  for (const role of roles) {
    const existing = await admin.query<{
      rolsuper: boolean
      rolcreatedb: boolean
      rolcreaterole: boolean
      rolbypassrls: boolean
      rolreplication: boolean
      rolcanlogin: boolean
    }>(
      'SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolreplication,rolcanlogin FROM pg_roles WHERE rolname=$1',
      [role.name],
    )
    const saved = role.previous ? databaseUrl(role.previous) : null
    const canReuse =
      saved?.username === role.name && saved.password.length >= 24
    if (existing.rows[0]) {
      const row = existing.rows[0]
      if (
        row.rolsuper ||
        row.rolcreatedb ||
        row.rolcreaterole ||
        row.rolbypassrls ||
        row.rolreplication ||
        !row.rolcanlogin
      )
        throw new Error('Unexpected privileged login role')
      if (!canReuse)
        throw new Error(
          'Existing role requires its current credential; refusing automatic password rotation',
        )
      role.url.password = saved!.password
    } else {
      role.url.password = canReuse
        ? saved!.password
        : randomBytes(32).toString('base64url')
      const statement = await admin.query<{ sql: string }>(
        "SELECT format('CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',$1::text,$2::text) AS sql",
        [role.name, decodeURIComponent(role.url.password)],
      )
      await admin.query(statement.rows[0]!.sql)
    }
    role.url.username = role.name
    await admin.query(`GRANT ${role.group} TO ${role.name}`)
    const probe = new pg.Pool({ connectionString: role.url.toString(), max: 1 })
    try {
      await probe.query('SELECT 1')
    } finally {
      await probe.end()
    }
  }
  const forbidden = await admin.query<{ member: boolean }>(
    "SELECT pg_has_role('pharmacy_app','migrator','MEMBER') AS member",
  )
  if (forbidden.rows[0]?.member)
    throw new Error('Runtime login must not inherit migrator')
  const envFile = new URL('../../../.env', import.meta.url)
  let text = ''
  try {
    text = await readFile(envFile, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  const line = `DATABASE_URL=${JSON.stringify(runtime.toString())}`
  text = /^DATABASE_URL=.*$/m.test(text)
    ? text.replace(/^DATABASE_URL=.*$/m, () => line)
    : `${text}\n${line}\n`
  await writeFile(envFile, text, { mode: 0o600 })
  await chmod(envFile, 0o600)
  const dbFile = new URL('../../../.env.db', import.meta.url)
  let savedDb = ''
  try {
    savedDb = await readFile(dbFile, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
  }
  for (const [key, value] of Object.entries({
    BOOTSTRAP_DATABASE_URL: bootstrap,
    MIGRATION_DATABASE_URL: maintenance.toString(),
  })) {
    const pattern = new RegExp(`^${key}=.*$`, 'm'),
      line = `${key}=${JSON.stringify(value)}`
    savedDb = pattern.test(savedDb)
      ? savedDb.replace(pattern, () => line)
      : `${savedDb}\n${line}\n`
  }
  await writeFile(dbFile, savedDb, { mode: 0o600 })
  await chmod(dbFile, 0o600)
  console.log(
    'Local app/migration roles ready; private env files updated without printing credentials.',
  )
} catch (error) {
  console.error(
    `Provisioning failed (${(error as NodeJS.ErrnoException).code ?? 'configuration'}); inspect configuration privately.`,
  )
  process.exitCode = 1
} finally {
  await admin.end()
}
