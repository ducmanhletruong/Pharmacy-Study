import { isDeepStrictEqual } from 'node:util'
import { open, readFile, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import {
  docker,
  fileHash,
  fingerprintSql,
  streamDocker,
} from './db-recovery-tools.mjs'

async function restore(directory) {
  if (!directory || !isAbsolute(directory))
    throw new Error(
      'Usage: node scripts/db-restore-check.mjs <absolute-backup-run-directory>',
    )
  const archive = join(directory, 'database.dump')
  const manifest = JSON.parse(
    await readFile(join(directory, 'manifest.json'), 'utf8'),
  )
  if (
    manifest.schema !== 1 ||
    !/^sha256:[a-f\d]{64}$/.test(manifest.image) ||
    manifest.archiveBytes !== (await stat(archive)).size ||
    manifest.archiveSha256 !== (await fileHash(archive))
  )
    throw new Error(
      'Archive size or SHA-256 does not match the backup manifest',
    )

  const started = performance.now()
  const container = await docker(
    [
      'run',
      '--detach',
      '--rm',
      '--pull=never',
      '--network=none',
      '--tmpfs',
      '/var/lib/postgresql/data:rw,size=1g',
      '-e',
      'POSTGRES_HOST_AUTH_METHOD=trust',
      '-e',
      'POSTGRES_DB=restore_check',
      manifest.image,
    ],
    'Cannot start the isolated restore container with the pinned local image',
  )
  if (!/^[a-f\d]{64}$/.test(container))
    throw new Error('Docker did not return an isolated container ID')
  try {
    const readinessDeadline = performance.now() + 45_000
    while (true) {
      try {
        await docker(
          [
            'exec',
            container,
            'pg_isready',
            '-h',
            '127.0.0.1',
            '-U',
            'postgres',
            '-d',
            'restore_check',
          ],
          'The isolated database is not ready',
        )
        break
      } catch (error) {
        if (performance.now() >= readinessDeadline) throw error
        await setTimeout(500)
      }
    }
    // Policies in the archive still reference roles when grants are omitted.
    await docker(
      [
        'exec',
        container,
        'psql',
        '-X',
        '-v',
        'ON_ERROR_STOP=1',
        '-U',
        'postgres',
        '-d',
        'restore_check',
        '-c',
        'CREATE ROLE app_rw NOLOGIN',
      ],
      'Cannot provision the role referenced by restored account policies',
    )
    const input = await open(archive, 'r')
    const restoreStarted = performance.now()
    try {
      await streamDocker(
        [
          'exec',
          '-i',
          container,
          'pg_restore',
          '--exit-on-error',
          '--no-owner',
          '--no-privileges',
          '-U',
          'postgres',
          '-d',
          'restore_check',
        ],
        'pg_restore failed in the isolated container',
        { input },
      )
    } finally {
      await input.close()
    }
    const restoreMs = Math.round(performance.now() - restoreStarted)
    const actual = JSON.parse(
      await docker(
        [
          'exec',
          '-e',
          'PGTZ=UTC',
          container,
          'psql',
          '-XAt',
          '-v',
          'ON_ERROR_STOP=1',
          '-U',
          'postgres',
          '-d',
          'restore_check',
          '-c',
          fingerprintSql,
        ],
        'Cannot fingerprint restored records',
      ),
    )
    if (!isDeepStrictEqual(actual, manifest.fingerprint))
      throw new Error(
        'Restored counts or content hashes differ from the backup snapshot',
      )
    console.log(
      JSON.stringify({
        verified: true,
        restoreMs,
        totalMs: Math.round(performance.now() - started),
        checked: manifest.fingerprint.counts,
        writtenPdfs: actual.contents.written_papers.count,
      }),
    )
  } finally {
    await docker(
      ['rm', '--force', container],
      'Could not clean up the isolated restore container',
    )
  }
}

restore(process.argv[2]).catch((error) => {
  console.error(
    error instanceof Error &&
      !('code' in error) &&
      !(error instanceof SyntaxError)
      ? error.message
      : 'Restore check failed locally',
  )
  process.exitCode = 1
})
