import {
  mkdtemp,
  open,
  realpath,
  rm,
  rmdir,
  stat,
  writeFile,
} from 'node:fs/promises'
import { createRequire } from 'node:module'
import { isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  docker,
  fileHash,
  fingerprintSql,
  secureWindowsDirectory,
  streamDocker,
} from './db-recovery-tools.mjs'

const repo = new URL('../', import.meta.url)
const require = createRequire(new URL('packages/db/package.json', repo))
const { Client } = require('pg')

async function backUp(container, parentPath) {
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_.-]*$/.test(container ?? '') ||
    !parentPath ||
    !isAbsolute(parentPath)
  )
    throw new Error(
      'Usage: node scripts/db-backup.mjs <postgres-container> <absolute-existing-directory-outside-repo>',
    )

  const parent = await realpath(parentPath)
  const location = relative(await realpath(fileURLToPath(repo)), parent)
  if (
    location !== '..' &&
    !location.startsWith('..' + sep) &&
    !isAbsolute(location)
  )
    throw new Error('Backup destination must be outside the repository')

  if (process.env.PHARMACY_SKIP_LOCAL_ENV !== '1') {
    for (const name of ['.env.db', '.env']) {
      try {
        process.loadEnvFile(new URL(name, repo))
      } catch (error) {
        if (error.code !== 'ENOENT')
          throw new Error('Cannot load local database configuration')
      }
    }
  }
  let url
  try {
    url = new URL(process.env.MIGRATION_DATABASE_URL)
  } catch {
    throw new Error('A local MIGRATION_DATABASE_URL is required')
  }
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    url.search ||
    url.hash
  )
    throw new Error(
      'Use a direct, loopback-only PostgreSQL migration URL with no URL options',
    )
  const user = decodeURIComponent(url.username)
  const password = decodeURIComponent(url.password)
  const database = decodeURIComponent(url.pathname.slice(1))
  if (!user || !database || !password || /[\r\n\0]/.test(password))
    throw new Error('A usable local maintenance login is required')

  const inspected = await docker(
    [
      'inspect',
      '--type',
      'container',
      '--format',
      '{{.Id}}\n{{.Image}}\n{{json (index .NetworkSettings.Ports "5432/tcp")}}',
      container,
    ],
    'Cannot inspect the selected local PostgreSQL container',
  )
  const [id, image, mapping] = inspected.split(/\r?\n/)
  const ports = JSON.parse(mapping)
  if (
    !/^[a-f\d]{64}$/.test(id) ||
    !/^sha256:[a-f\d]{64}$/.test(image) ||
    ports?.length !== 1 ||
    ports[0].HostIp !== '127.0.0.1' ||
    ports[0].HostPort !== (url.port || '5432')
  )
    throw new Error(
      'The maintenance URL must point to the selected container’s sole loopback port',
    )

  const directory = await mkdtemp(join(parent, 'pharmacy-backup-'))
  const archive = join(directory, 'database.dump')
  const manifestPath = join(directory, 'manifest.json')
  let completed = false
  const client = new Client({
    connectionString: url.toString(),
    connectionTimeoutMillis: 5_000,
    statement_timeout: 60_000,
  })
  // The pending query/pg_dump result controls the backup outcome.
  client.on('error', () => {})
  try {
    await secureWindowsDirectory(directory)
    await client.connect().catch(() => {
      throw new Error(
        'Cannot connect with the configured local maintenance login',
      )
    })
    const sql = async (query) => {
      try {
        return (await client.query(query)).rows[0]
      } catch {
        throw new Error(
          'Cannot read the snapshot with the configured maintenance role and schema',
        )
      }
    }
    await sql("SET TIME ZONE 'UTC'")
    await sql('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const role =
      await sql(`SELECT pg_has_role(current_user, 'migrator', 'USAGE') AS maintenance,
      (SELECT rolsuper FROM pg_roles WHERE rolname=current_user) AS elevated,
      current_setting('server_version_num')::int AS version,
      pg_export_snapshot() AS snapshot`)
    if (
      !role.maintenance ||
      role.elevated ||
      role.version < 170000 ||
      role.version >= 180000
    )
      throw new Error(
        'A PostgreSQL 17 login inheriting migrator without superuser is required',
      )

    const { fingerprint } = await sql(fingerprintSql)
    const output = await open(archive, 'wx', 0o600)
    try {
      await streamDocker(
        [
          'exec',
          '-i',
          id,
          'sh',
          '-c',
          'IFS= read -r PGPASSWORD || exit 1; export PGPASSWORD; exec pg_dump "$@"',
          'sh',
          '--host=127.0.0.1',
          '--no-password',
          '--username',
          user,
          '--dbname',
          database,
          '--format=custom',
          '--snapshot',
          role.snapshot,
          '--lock-wait-timeout=5s',
        ],
        'pg_dump failed while reading the maintenance snapshot',
        { password, output },
      )
      await output.sync()
    } finally {
      await output.close()
    }
    await sql('ROLLBACK')
    const manifest = {
      schema: 1,
      createdAt: new Date().toISOString(),
      image,
      archiveBytes: (await stat(archive)).size,
      archiveSha256: await fileHash(archive),
      fingerprint,
    }
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    })
    completed = true
    console.log(
      JSON.stringify({
        directory,
        archiveBytes: manifest.archiveBytes,
        verifiedTables: countFingerprints(fingerprint),
      }),
    )
  } finally {
    await client.end().catch(() => {})
    if (!completed) {
      await rm(archive, { force: true })
      await rm(manifestPath, { force: true })
      await rmdir(directory)
    }
  }
}

function countFingerprints({ counts, contents }) {
  return Object.keys(counts).length + Object.keys(contents).length
}

backUp(...process.argv.slice(2)).catch((error) => {
  console.error(
    error instanceof Error && !('code' in error)
      ? error.message
      : 'Backup failed locally',
  )
  process.exitCode = 1
})
