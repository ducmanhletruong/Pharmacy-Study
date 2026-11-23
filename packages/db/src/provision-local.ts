import { randomBytes, randomUUID } from 'node:crypto'
import { readFile, rename, rm, mkdir, open } from 'node:fs/promises'
import pg from 'pg'

type Connection = Pick<pg.Pool, 'query' | 'end'>
export async function writePrivate(path: URL, text: string) {
  const temporary = new URL(`.env.write-${randomUUID()}.tmp`, path)
  try {
    const file = await open(temporary, 'wx', 0o600)
    try {
      await file.writeFile(text)
      await file.sync()
    } finally {
      await file.close()
    }
    await rename(temporary, path)
  } finally {
    await rm(temporary, { force: true })
  }
}
async function optional(path: URL) {
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw error
  }
}
function url(value: string) {
  try {
    return new URL(value)
  } catch {
    throw new Error('Invalid private database URL configuration')
  }
}
function identity(value: URL) {
  const copy = new URL(value)
  copy.username = ''
  copy.password = ''
  return copy.toString()
}
function upsert(text: string, values: Record<string, string>) {
  for (const [key, value] of Object.entries(values)) {
    const pattern = new RegExp(`^${key}=.*$`, 'm'),
      line = `${key}=${JSON.stringify(value)}`
    text = pattern.test(text)
      ? text.replace(pattern, () => line)
      : `${text}\n${line}\n`
  }
  return text
}
export async function provisionLocal(input: {
  bootstrap: string
  runtimePrevious?: string
  migrationPrevious?: string
  root?: URL
  connect?: (connectionString: string) => Connection
  writeEnv?: typeof writePrivate
}) {
  const base = url(input.bootstrap)
  if (!['localhost', '127.0.0.1', '[::1]'].includes(base.hostname))
    throw new Error('Local provisioning only')
  const root = input.root ?? new URL('../../../', import.meta.url),
    journal = new URL('.env.provision.json', root),
    lock = new URL('.env.provision.lock/', root)
  // Never reap a lock from an unknown writer. After a crash, confirm no CLI is
  // running, remove this directory, and rerun using the durable journal.
  await mkdir(lock, { mode: 0o700 })
  let admin: Connection | undefined
  let transaction = false
  try {
    const saved = await optional(journal)
    let urls: string[]
    if (saved) {
      const parsed = JSON.parse(saved)
      if (
        parsed.version !== 1 ||
        parsed.database !== identity(base) ||
        !Array.isArray(parsed.urls) ||
        parsed.urls.length !== 2
      )
        throw new Error('Invalid private provision journal')
      urls = parsed.urls
    } else {
      urls = [input.runtimePrevious, input.migrationPrevious].map(
        (value, index) => {
          const name = index === 0 ? 'pharmacy_app' : 'pharmacy_migrator',
            prior = value ? url(value) : null
          const target = new URL(base)
          target.username = name
          target.password =
            prior?.username === name && prior.password.length >= 24
              ? prior.password
              : randomBytes(32).toString('base64url')
          return target.toString()
        },
      )
    }
    for (const [index, value] of urls.entries()) {
      const target = url(value)
      if (
        identity(target) !== identity(base) ||
        target.username !==
          (index === 0 ? 'pharmacy_app' : 'pharmacy_migrator') ||
        target.password.length < 24
      )
        throw new Error('Invalid private provision journal role')
    }
    // Credentials reach durable private storage BEFORE any CREATE ROLE commits.
    if (!saved) {
      const file = await open(journal, 'wx', 0o600)
      try {
        await file.writeFile(
          JSON.stringify({ version: 1, database: identity(base), urls }),
        )
        await file.sync()
      } finally {
        await file.close()
      }
    }
    const connect =
      input.connect ??
      ((connectionString: string) => new pg.Pool({ connectionString, max: 1 }))
    admin = connect(input.bootstrap)
    await admin.query('BEGIN')
    transaction = true
    const groups = ['app_rw', 'migrator']
    for (const [index, value] of urls.entries()) {
      const target = url(value),
        name = target.username
      const existing = await admin.query(
        'SELECT rolsuper,rolcreatedb,rolcreaterole,rolbypassrls,rolreplication,rolcanlogin FROM pg_roles WHERE rolname=$1',
        [name],
      )
      const row = existing.rows[0]
      if (row) {
        if (
          row.rolsuper ||
          row.rolcreatedb ||
          row.rolcreaterole ||
          row.rolbypassrls ||
          row.rolreplication ||
          !row.rolcanlogin
        )
          throw new Error('Unexpected privileged login role')
        const existingProbe = connect(value)
        try {
          await existingProbe.query('SELECT 1')
        } finally {
          await existingProbe.end()
        }
        // Existing credentials are only probed, never rotated. A newly generated
        // journal cannot grant access without proving this role's current password.
      } else {
        const statement = await admin.query(
          "SELECT format('CREATE ROLE %I LOGIN INHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',$1::text,$2::text) AS sql",
          [name, decodeURIComponent(target.password)],
        )
        await admin.query(statement.rows[0].sql)
      }
      await admin.query(`GRANT ${groups[index]} TO ${name}`)
    }
    const forbidden = await admin.query(
      "SELECT pg_has_role('pharmacy_app','migrator','MEMBER') AS member",
    )
    if (forbidden.rows[0]?.member)
      throw new Error('Runtime login must not inherit migrator')
    await admin.query('COMMIT')
    transaction = false
    for (const value of urls) {
      const probe = connect(value)
      try {
        await probe.query('SELECT 1')
      } finally {
        await probe.end()
      }
    }
    const env = new URL('.env', root),
      db = new URL('.env.db', root),
      write = input.writeEnv ?? writePrivate
    await write(
      db,
      upsert(await optional(db), {
        BOOTSTRAP_DATABASE_URL: input.bootstrap,
        MIGRATION_DATABASE_URL: urls[1]!,
      }),
    )
    await write(env, upsert(await optional(env), { DATABASE_URL: urls[0]! }))
    await rm(journal)
  } catch (error) {
    if (transaction) await admin?.query('ROLLBACK')
    throw error
  } finally {
    try {
      await admin?.end()
    } finally {
      await rm(lock, { recursive: true, force: true })
    }
  }
}
