import { createRequire } from 'node:module'
const pg = createRequire(
  new URL('../packages/db/package.json', import.meta.url),
)('pg')
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { POST } from '../apps/web/src/app/api/v1/attempts/route'
import { closeDb } from '../packages/db/src/client'
import {
  getMaintenancePool,
  closeMaintenance,
} from '../packages/db/src/maintenance'

function databaseUrl(name: string) {
  const value = process.env[name]
  if (!value) throw new Error(`Provide ${name} for the isolated benchmark`)
  const url = new URL(value)
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    url.search ||
    url.hash
  )
    throw new Error(`${name} must be a loopback PostgreSQL URL without options`)
  return url
}
const maintenance = databaseUrl('MIGRATION_DATABASE_URL')
const bootstrap = databaseUrl('BOOTSTRAP_DATABASE_URL')
const runtime = databaseUrl('DATABASE_URL')
const endpoint = (url: URL) => `${url.hostname}:${url.port || '5432'}`
if ([maintenance, runtime].some((url) => endpoint(url) !== endpoint(bootstrap)))
  throw new Error('All benchmark roles must use the same PostgreSQL endpoint')
process.env.PHARMACY_SKIP_LOCAL_ENV = '1'
const reused = process.env.P05_BENCH_REUSE_DATABASE
if (reused && !/^pharmacy_p05_bench_[a-f0-9]{32}$/.test(reused))
  throw new Error('Invalid benchmark database name')
const database =
  reused ?? 'pharmacy_p05_bench_' + randomUUID().replaceAll('-', '')
const owner = new pg.Client({ connectionString: bootstrap.toString() })
await owner.connect()
if (!reused) await owner.query(`CREATE DATABASE "${database}"`)
bootstrap.pathname = '/' + database
maintenance.pathname = '/' + database
runtime.pathname = '/' + database
process.env.BOOTSTRAP_DATABASE_URL = bootstrap.toString()
process.env.MIGRATION_DATABASE_URL = bootstrap.toString()
process.env.DATABASE_URL = runtime.toString()
process.env.AUTH_MODE = 'dev'
const httpMode = process.env.P05_BENCH_HTTP === '1'
const baseOrigin = httpMode ? 'http://127.0.0.1:3002' : 'http://localhost:3000'
process.env.APP_ORIGIN = baseOrigin
process.env.NEXTAUTH_URL = baseOrigin
let app: ChildProcess | undefined
const questionCount = Number(process.env.P05_BENCH_QUESTIONS ?? 10)
if (![10, 120].includes(questionCount))
  throw new Error('Benchmark uses 10 or 120 questions')
process.env.RATE_LIMIT_ATTEMPT_CREATE = '10000'
const child = (path: string) =>
  execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', path], {
    env: process.env,
    stdio: 'pipe',
  })
try {
  if (!reused) {
    child('packages/db/src/migrate.ts')
    process.env.MIGRATION_DATABASE_URL = maintenance.toString()
    child('packages/db/src/seed.ts')
    child('packages/db/src/migrate.ts')
    console.log(
      'Empty DB migrations, seed and migration rerun passed. Preparing 20,000 synthetic questions.',
    )
  }
  process.env.MIGRATION_DATABASE_URL = maintenance.toString()
  const db = getMaintenancePool()
  if (process.env.P05_BENCH_MIGRATIONS_ONLY === '1') {
    if (reused) throw new Error('Migration smoke requires a fresh database')
    child('packages/db/src/seed.ts')
    const migrations = await db.query(
      'SELECT name,hash FROM _migrations ORDER BY name',
    )
    const report = {
      generated_at: new Date().toISOString(),
      database_retained: database,
      migrations: migrations.rows,
      seed_rerun: 'passed',
      scope:
        'Fresh local database, no user content, production migrations unchanged',
    }
    mkdirSync('docs/performance', { recursive: true })
    writeFileSync(
      'docs/performance/p05-empty-db.json',
      JSON.stringify(report, null, 2) + '\n',
    )
    console.log(
      JSON.stringify({
        empty_database: 'passed',
        migrations: migrations.rowCount,
        seed_rerun: 'passed',
      }),
    )
  } else {
    if (!reused) {
      const client = await db.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          'CREATE TEMP TABLE bench_map(qid uuid,rid uuid,n int) ON COMMIT DROP',
        )
        await client.query(
          'INSERT INTO bench_map SELECT gen_random_uuid(),gen_random_uuid(),n FROM generate_series(1,19990) n',
        )
        await client.query(`INSERT INTO questions(id,subject_id,type,difficulty,status)
   SELECT m.qid,s.id,'mcq',1,'draft' FROM bench_map m CROSS JOIN subjects s WHERE s.code='synthetic'`)
        await client.query(`INSERT INTO question_revisions(id,question_id,rev_no,stem,payload,explanation,content_hash,created_by)
   SELECT rid,qid,1,'Synthetic benchmark MCQ '||n,'{"sources":[{"title":"Synthetic benchmark","locator":"generated"}]}'::jsonb,
   'Synthetic explanation',md5(qid::text)||md5(qid::text),'00000000-0000-4000-8000-000000000001' FROM bench_map`)
        await client.query(`INSERT INTO question_choices(revision_id,label,text,is_correct)
   SELECT rid,label,label||' synthetic choice',label='A' FROM bench_map CROSS JOIN unnest(ARRAY['A','B','C','D']) label`)
        await client.query(`WITH source AS (
          INSERT INTO sources(subject_id,kind,title,locator,license,review_status,retrieved_at,fingerprint,audience)
          SELECT id,'manual','Synthetic benchmark','generated','project-authored','approved',now(),'synthetic:benchmark','public'
          FROM subjects WHERE code='synthetic' RETURNING id
        )
        INSERT INTO question_sources(revision_id,source_id,locator)
        SELECT bench_map.rid,source.id,'generated' FROM bench_map CROSS JOIN source`)
        // Seed all rows in one transaction. Refresh provenance stats before
        // approval triggers inspect the newly populated table for each revision.
        await client.query('ANALYZE question_sources')
        await client.query('ANALYZE question_choices')
        await client.query(
          `UPDATE questions q SET current_revision_id=m.rid,status='approved' FROM bench_map m WHERE q.id=m.qid`,
        )
        await client.query(`INSERT INTO question_topics(question_id,topic_id,subject_id)
   SELECT qid,t.id,t.subject_id FROM bench_map CROSS JOIN topics t WHERE t.code='sample-0'`)
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      } finally {
        client.release()
      }
    }
    await db.query('ANALYZE questions')
    await db.query('ANALYZE question_topics')
    const count = await db.query(
      "SELECT count(*)::int count FROM questions WHERE status='approved' AND subject_id=(SELECT id FROM subjects WHERE code='synthetic')",
    )
    if (count.rows[0].count !== 20000)
      throw new Error('Benchmark population must be exactly 20,000')
    child('packages/db/src/migrate.ts')
    const visible = await db.query(
      `SELECT count(*)::int count FROM questions q JOIN subjects s ON s.id=q.subject_id
       JOIN released_revision_audiences a ON a.revision_id=q.current_revision_id AND a.subject_id=q.subject_id
       WHERE s.code='synthetic' AND q.status='approved' AND a.minimum_tier=1`,
    )
    if (visible.rows[0].count !== 20000)
      throw new Error(
        'Benchmark requires 20,000 public questions with reviewed provenance; use a fresh benchmark database',
      )
    await db.query(
      `UPDATE exam_blueprints SET spec=jsonb_set(spec,'{slots}',$1::jsonb) WHERE id='00000000-0000-4000-8000-000000000505'`,
      [JSON.stringify([{ count: questionCount }])],
    )
    if (httpMode) {
      app = spawn(process.execPath, ['scripts/dev.mjs'], {
        env: { ...process.env, PORT: '3002' },
        stdio: 'ignore',
        windowsHide: true,
      })
      const deadline = Date.now() + 30000
      let ready = false
      while (Date.now() < deadline) {
        try {
          const health = await fetch(baseOrigin + '/api/v1/health')
          if (health.ok) {
            ready = true
            break
          }
        } catch {}
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      if (!ready) throw new Error('Benchmark HTTP server did not become ready')
    }
    const blueprint = '00000000-0000-4000-8000-000000000505'
    const samples: number[] = []
    for (let index = 0; index < 33; index++) {
      const request = new Request(baseOrigin + '/api/v1/attempts', {
        method: 'POST',
        headers: {
          Origin: baseOrigin,
          'Content-Type': 'application/json',
          'Idempotency-Key': randomUUID(),
        },
        body: JSON.stringify({
          subject: 'synthetic',
          mode: 'mock',
          blueprint_id: blueprint,
        }),
      })
      const started = performance.now()
      const response = httpMode ? await fetch(request) : await POST(request)
      const value = await response.json()
      const elapsed = performance.now() - started
      if (response.status !== 201 || value.items?.length !== questionCount)
        throw new Error('Benchmark request did not create a full mock')
      if (index >= 3) samples.push(elapsed)
    }
    samples.sort((a, b) => a - b)
    const report = {
      generated_at: new Date().toISOString(),
      questions: 20000,
      mode: 'mock',
      questions_per_attempt: questionCount,
      measured_requests: samples.length,
      warmup_requests: 3,
      p50_ms: samples[Math.ceil(samples.length * 0.5) - 1],
      p95_ms: samples[Math.ceil(samples.length * 0.95) - 1],
      max_ms: samples.at(-1),
      target_ms: 500,
      measurement: httpMode
        ? 'Real HTTP API-03 through Next dev on Windows, auth/Origin/rate/DB/serialization; loopback TCP, no TLS'
        : 'API-03 route handler through auth/Origin/rate/DB/serialization on local Windows; excludes TCP/TLS and browser latency',
      database_retained: database,
      empty_db_migration_and_rerun: 'passed',
    }
    mkdirSync('docs/performance', { recursive: true })
    writeFileSync(
      httpMode
        ? 'docs/performance/p05-assembly-http-' + questionCount + '.json'
        : 'docs/performance/p05-assembly.json',
      JSON.stringify(report, null, 2) + '\n',
    )
    console.log(JSON.stringify(report))
    if (report.p95_ms! >= 500) process.exitCode = 1
  }
} finally {
  if (app?.pid) {
    try {
      if (process.platform === 'win32')
        execFileSync('taskkill', ['/PID', String(app.pid), '/T', '/F'], {
          stdio: 'ignore',
        })
      else app.kill('SIGTERM')
    } catch {}
  }
  await closeDb()
  await closeMaintenance()
  await owner.end()
}
