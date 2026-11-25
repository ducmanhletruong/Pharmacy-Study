import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from './maintenance'
import { readFile, readdir } from 'node:fs/promises'
import { migrationIdentity } from './migration-checksum'

loadMaintenanceEnv()
const client = await getMaintenancePool().connect()
try {
  await client.query('BEGIN')
  await client.query(
    "SELECT pg_advisory_xact_lock(hashtext('pharmacy-migrations'))",
  )
  await client.query(
    'CREATE TABLE IF NOT EXISTS _migrations (name text PRIMARY KEY, hash text NOT NULL, applied_at timestamptz DEFAULT now())',
  )
  const directory = new URL('../migrations/', import.meta.url)
  for (const name of (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort()) {
    const { sql, hash, matches } = migrationIdentity(
      name,
      await readFile(new URL(name, directory), 'utf8'),
    )
    const previous = await client.query<{ hash: string }>(
      'SELECT hash FROM _migrations WHERE name=$1',
      [name],
    )
    if (previous.rows[0]) {
      if (!matches(previous.rows[0].hash))
        throw new Error(`Applied migration was modified: ${name}`)
      continue
    }
    await client.query(sql)
    await client.query('INSERT INTO _migrations(name,hash) VALUES($1,$2)', [
      name,
      hash,
    ])
    console.log(`Applied ${name}`)
  }
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await closeMaintenance()
}
