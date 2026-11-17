import { randomUUID, createHash } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import {
  getPool,
  closeDb,
  assertRuntimeDatabase,
} from '../../packages/db/src/client'
import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from '../../packages/db/src/maintenance'
import {
  registerIdentity,
  createSession,
  sessionMember,
  revokeSession,
} from '../../packages/db/src/auth'
import { appendAudit, type AuditDetails } from '../../packages/db/src/audit'
import { takeRateLimit } from '../../packages/db/src/limits'
import {
  createAttempt,
  getAttempt,
  answerItem,
  submitAttempt,
} from '../../packages/db/src/practice'
import { assertAttemptAccess } from '../../apps/web/src/server/permissions'
import { readBody } from '../../apps/web/src/server/security/body'

loadMaintenanceEnv()
const users: string[] = [],
  attempts: string[] = [],
  requests: string[] = [],
  limits: string[] = []
const email = () => `fixture-${randomUUID()}@example.invalid`
async function member(role: 'admin' | 'learner' = 'learner') {
  const e = email()
  const user = await registerIdentity({
    provider: 'test',
    subject: e,
    email: e,
    name: 'Synthetic fixture',
    role,
  })
  expect(user).not.toBeNull()
  users.push(user!.id)
  return user!
}
afterAll(async () => {
  const db = getMaintenancePool()
  await db.query('DELETE FROM attempt_items WHERE attempt_id=ANY($1::uuid[])', [
    attempts,
  ])
  await db.query('DELETE FROM attempts WHERE id=ANY($1::uuid[])', [attempts])
  await db.query(
    'DELETE FROM audit_logs WHERE actor_user_id=ANY($1::uuid[]) OR request_id=ANY($2::uuid[])',
    [users, requests],
  )
  await db.query('DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])', [
    users,
  ])
  await db.query('DELETE FROM auth_identities WHERE user_id=ANY($1::uuid[])', [
    users,
  ])
  await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [users])
  await db.query('DELETE FROM request_limits WHERE bucket=ANY($1::text[])', [
    limits,
  ])
  await closeDb()
  await closeMaintenance()
})
test('A/B and admin owner filters deny reading, answering and submitting another user attempt', async () => {
  const a = await member(),
    b = await member(),
    admin = await member('admin')
  const result = await createAttempt(
    { subject: 'synthetic', mode: 'practice', type: 'mcq', count: 1 },
    randomUUID(),
    a.id,
  )
  const id = result.attempt.id
  attempts.push(id)
  for (const actor of [b, admin]) {
    await expect(
      assertAttemptAccess(actor, id, 'attempt:read'),
    ).rejects.toMatchObject({ status: 404 })
    await expect(getAttempt(id, actor.id)).rejects.toMatchObject({
      status: 404,
    })
    await expect(
      answerItem(id, 1, 'A', undefined, actor.id),
    ).rejects.toMatchObject({ status: 404 })
    await expect(submitAttempt(id, actor.id)).rejects.toMatchObject({
      status: 404,
    })
  }
  expect((await getAttempt(id, a.id)).id).toBe(id)
})
test('revoked, expired and disabled sessions cannot resolve a member', async () => {
  const user = await member(),
    rid = randomUUID()
  requests.push(rid)
  const sid = await createSession(user.id, 'test', rid)
  expect((await sessionMember(user.id, sid))?.id).toBe(user.id)
  await revokeSession(user.id, sid, rid)
  expect(await sessionMember(user.id, sid)).toBeNull()
  const expired = await createSession(user.id, 'test', rid)
  await getMaintenancePool().query(
    "UPDATE auth_sessions SET expires_at=now()-interval '1 second' WHERE id=$1",
    [expired],
  )
  expect(await sessionMember(user.id, expired)).toBeNull()
  const active = await createSession(user.id, 'test', rid)
  await getMaintenancePool().query(
    "UPDATE users SET status='disabled' WHERE id=$1",
    [user.id],
  )
  expect(await sessionMember(user.id, active)).toBeNull()
  expect(
    await registerIdentity({
      provider: 'test',
      subject: user.email,
      email: user.email,
      name: 'Do not reactivate',
      role: 'admin',
    }),
  ).toBeNull()
})
test('a reassigned email or a different provider subject cannot silently link existing data', async () => {
  const user = await member()
  expect(
    await registerIdentity({
      provider: 'test',
      subject: randomUUID(),
      email: user.email,
      name: 'different identity',
      role: 'learner',
    }),
  ).toBeNull()
  expect(
    await registerIdentity({
      provider: 'google',
      subject: randomUUID(),
      email: user.email,
      name: 'different provider',
      role: 'learner',
    }),
  ).toBeNull()
})
test('app_rw can append/read audit, but cannot UPDATE, DELETE, TRUNCATE or DDL', async () => {
  const requestId = randomUUID()
  requests.push(requestId)
  await appendAudit(getPool(), {
    actorId: null,
    action: 'test.append',
    entityType: 'fixture',
    requestId,
    details: {
      provider: 'test',
      token: 'SENSITIVE-SENTINEL',
      cookie: 'SENSITIVE-SENTINEL',
      role: 'SENSITIVE-SENTINEL',
    } as unknown as AuditDetails,
  })
  const record = await getPool().query(
    'SELECT diff FROM audit_logs WHERE request_id=$1',
    [requestId],
  )
  expect(record.rows[0].diff).toEqual({ provider: 'test' })
  for (const sql of [
    "UPDATE audit_logs SET action='tampered' WHERE false",
    'DELETE FROM audit_logs WHERE false',
    'TRUNCATE audit_logs',
    'ALTER TABLE audit_logs ADD COLUMN forbidden_probe text',
  ]) {
    const client = await getPool().connect()
    await client.query('BEGIN')
    try {
      await expect(client.query(sql)).rejects.toMatchObject({ code: '42501' })
    } finally {
      await client.query('ROLLBACK')
      client.release()
    }
  }
})
test('concurrent rate budget is atomic and reports retry seconds without exposing keys', async () => {
  const key = `test-limit:${randomUUID()}`
  limits.push(createHash('sha256').update(key).digest('hex'))
  const results = await Promise.all(
    Array.from({ length: 5 }, () => takeRateLimit(key, 2)),
  )
  expect(results.filter((r) => r.allowed)).toHaveLength(2)
  expect(results.every((r) => r.retryAfter >= 1 && r.retryAfter <= 60)).toBe(
    true,
  )
})
test('runtime accepts app login and rejects the migration/bootstrap credential', async () => {
  await assertRuntimeDatabase()
  const original = process.env.DATABASE_URL
  try {
    for (const url of [
      process.env.MIGRATION_DATABASE_URL,
      process.env.BOOTSTRAP_DATABASE_URL,
    ]) {
      if (!url) throw new Error('Separate migration/bootstrap fixture required')
      await closeDb()
      process.env.DATABASE_URL = url
      await expect(assertRuntimeDatabase()).rejects.toThrow(
        /unprivileged app_rw/,
      )
    }
  } finally {
    await closeDb()
    process.env.DATABASE_URL = original
  }
})
test('stream body limit works without trusting Content-Length', async () => {
  const request = new Request('http://localhost/api', {
    method: 'POST',
    body: 'x'.repeat(17000),
  })
  await expect(readBody(request)).rejects.toMatchObject({ status: 413 })
  expect(
    await readBody(
      new Request('http://localhost/api', {
        method: 'POST',
        body: '{"ok":true}',
      }),
    ),
  ).toBe('{"ok":true}')
})
