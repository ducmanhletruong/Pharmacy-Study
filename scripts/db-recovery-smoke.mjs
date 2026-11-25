import { resolve as resolvePath } from 'node:path'
import { createRequire } from 'node:module'
import { setTimeout } from 'node:timers/promises'
import { docker, runTool } from './db-recovery-tools.mjs'

const password = 'synthetic-fixture-only'
const cli = createRequire(import.meta.url).resolve('tsx/cli')
const appClient = new URL('../packages/db/src/client.ts', import.meta.url).href

async function smoke(image, parent, integration) {
  if (!/^sha256:[a-f\d]{64}$/.test(image ?? '') || !parent)
    throw new Error(
      'Usage: node scripts/db-recovery-smoke.mjs <local-image-id> <backup-directory> [--integration]',
    )
  const container = await docker(
    [
      'run',
      '--detach',
      '--rm',
      '--pull=never',
      '-p',
      '127.0.0.1::5432',
      '--tmpfs',
      '/var/lib/postgresql/data:rw,size=1g',
      '-e',
      'POSTGRES_DB=synthetic_recovery',
      '-e',
      `POSTGRES_PASSWORD=${password}`,
      image,
    ],
    'Could not start synthetic PostgreSQL',
  )
  if (!/^[a-f\d]{64}$/.test(container))
    throw new Error('Docker did not return a synthetic container ID')

  try {
    const end = performance.now() + 45_000
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
          ],
          'Synthetic PostgreSQL is not ready',
        )
        break
      } catch (error) {
        if (performance.now() >= end) throw error
        await setTimeout(500)
      }
    }
    const hostPort = await docker(
      ['port', container, '5432/tcp'],
      'Could not read the synthetic database port',
    )
    if (!/^127\.0\.0\.1:\d+$/.test(hostPort))
      throw new Error('Synthetic PostgreSQL is not loopback-only')
    const url = (user) =>
      `postgresql://${user}:${password}@${hostPort}/synthetic_recovery`
    const env = {
      ...process.env,
      PHARMACY_SKIP_LOCAL_ENV: '1',
      DATABASE_URL: url('fixture_app'),
      MIGRATION_DATABASE_URL: url('postgres'),
      BOOTSTRAP_DATABASE_URL: url('postgres'),
      AUTH_MODE: 'disabled',
      APP_ORIGIN: 'http://127.0.0.1:3000',
    }
    const runNode = (args, step, timeout = 20_000) =>
      runTool(process.execPath, args, step, { env, timeout })
    const sql = (query) =>
      docker(
        [
          'exec',
          container,
          'psql',
          '-XAt',
          '-v',
          'ON_ERROR_STOP=1',
          '-U',
          'postgres',
          '-d',
          'synthetic_recovery',
          '-c',
          query,
        ],
        'Cannot create or query synthetic fixtures',
      )

    await runNode(
      [cli, 'packages/db/src/migrate.ts'],
      'Synthetic migrations failed',
    )
    await sql(`
      CREATE ROLE fixture_maintenance LOGIN PASSWORD '${password}' IN ROLE migrator;
      CREATE ROLE fixture_app LOGIN PASSWORD '${password}' IN ROLE app_rw;
    `)
    env.MIGRATION_DATABASE_URL = url('fixture_maintenance')
    await runNode([cli, 'packages/db/src/seed.ts'], 'Synthetic seed failed')
    await sql(`
      WITH paper AS (
        INSERT INTO written_papers(user_id,subject_code,name,duration_seconds,sections,exam_pdf,reference_pdf,content_hash)
        SELECT id,'synthetic','Synthetic PDF bytes',60,'[]',convert_to('%PDF-1.4 synthetic test', 'UTF8'),
          convert_to('%PDF-1.4 synthetic reference', 'UTF8'), 'fixture'
        FROM users WHERE email='dev@example.invalid' RETURNING id,user_id
      ), attempt AS (
        INSERT INTO written_attempts(user_id,paper_id,paper_snapshot,deadline_at,idempotency_key,request_hash)
        SELECT user_id,id,'{}', now(), 'fixture', 'fixture' FROM paper RETURNING id
      )
      INSERT INTO written_answers(attempt_id,position,text) SELECT id,1,'Synthetic answer' FROM attempt;
    `)
    const archive = JSON.parse(
      await runNode(
        ['scripts/db-backup.mjs', container, resolvePath(parent)],
        'Synthetic backup failed',
      ),
    )
    const result = JSON.parse(
      await runNode(
        ['scripts/db-restore-check.mjs', archive.directory],
        'Synthetic restore check failed',
        65_000,
      ),
    )
    if (
      !result.verified ||
      result.writtenPdfs !== 1 ||
      result.checked.approved_questions < 1
    )
      throw new Error(
        'The synthetic restore did not exercise both approved questions and PDFs',
      )
    console.log(JSON.stringify({ synthetic: true, ...result }))

    const poolCheck = await runNode(
      [
        '--import',
        'tsx',
        '--input-type=module',
        '-e',
        `
      import { getPool, closeDb } from '${appClient}';
      import { once } from 'node:events';
      const pool = getPool();
      const idle = await pool.connect();
      const pid = (await idle.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      const killer = await pool.connect();
      idle.release();
      try {
        const reported = once(pool, 'error', { signal: AbortSignal.timeout(5000) });
        await killer.query('SELECT pg_terminate_backend($1)', [pid]);
        const [error] = await reported;
        if (error.code !== '57P01') throw Error('Expected PostgreSQL to terminate the idle backend');
      } finally {
        killer.release();
      }
      if ((await pool.query('SELECT 1 AS result')).rows[0].result !== 1) throw Error('Pool did not recover');
      await closeDb();
      console.log('Idle PostgreSQL disconnect handled and pool still serves queries');
    `,
      ],
      'Pool did not survive an idle connection being terminated',
    )
    console.log(poolCheck)
    if (integration === '--integration') {
      console.log(
        await runNode(
          [
            'node_modules/vitest/vitest.mjs',
            'run',
            '--config',
            'vitest.integration.config.ts',
          ],
          'Integration tests failed in the synthetic database',
          180_000,
        ),
      )
    }
  } finally {
    await docker(
      ['rm', '--force', container],
      'Could not clean up the synthetic test container',
    )
  }
}

smoke(...process.argv.slice(2)).catch((error) => {
  console.error(
    error instanceof Error && !('code' in error)
      ? error.message
      : 'Synthetic recovery check failed',
  )
  process.exitCode = 1
})
