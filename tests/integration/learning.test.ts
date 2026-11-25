import { randomUUID, createHash } from 'node:crypto'
import { beforeAll, afterAll, expect, test } from 'vitest'
import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from '../../packages/db/src/maintenance'
import { getPool, closeDb } from '../../packages/db/src/client'
import {
  createAttempt,
  getAttempt,
  answerItem,
  submitAttempt,
} from '../../packages/db/src/practice'
import {
  saveBlueprint,
  progress,
  listBlueprints,
} from '../../packages/db/src/learning'
import {
  createAttemptSchema,
  blueprintInputSchema,
} from '../../packages/api-contract/src'
loadMaintenanceEnv()
const admin = randomUUID(),
  learner = randomUUID(),
  other = randomUUID(),
  ids: string[] = [],
  bps: string[] = []
const db = getMaintenancePool()
async function blueprint(duration = 600, count = 3) {
  const input = blueprintInputSchema.parse({
    subject: 'synthetic',
    name: 'P05 synthetic ' + randomUUID(),
    status: 'active',
    spec: { duration_seconds: duration, slots: [{ count }] },
  })
  const r = await saveBlueprint(
    input,
    admin,
    randomUUID(),
    undefined,
    randomUUID(),
  )
  bps.push(r.item.id)
  return r.item
}
async function mock(bp: string) {
  const key = randomUUID()
  const input = createAttemptSchema.parse({
    subject: 'synthetic',
    mode: 'mock',
    blueprint_id: bp,
  })
  const r = await createAttempt(input, key, learner)
  ids.push(r.attempt.id)
  return { r, key, input }
}
beforeAll(async () => {
  await db.query(
    "INSERT INTO users(id,email,display_name,role) VALUES($1::uuid,$1::text||'@example.invalid','P05 fixture','admin'),($2::uuid,$2::text||'@example.invalid','P05 fixture','learner'),($3::uuid,$3::text||'@example.invalid','P05 fixture','learner')",
    [admin, learner, other],
  )
})
afterAll(async () => {
  await db.query(
    'DELETE FROM attempt_items WHERE attempt_id IN(SELECT id FROM attempts WHERE user_id=ANY($1::uuid[]))',
    [[learner, other]],
  )
  await db.query('DELETE FROM attempts WHERE user_id=ANY($1::uuid[])', [
    [learner, other],
  ])
  await db.query('DELETE FROM exam_blueprints WHERE id=ANY($1::uuid[])', [bps])
  await db.query('DELETE FROM audit_logs WHERE actor_user_id=ANY($1::uuid[])', [
    [admin, learner, other],
  ])
  await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [
    [admin, learner, other],
  ])
  await closeDb()
  await closeMaintenance()
})
test('blueprint version conflicts, learner denial and create idempotency', async () => {
  const input = blueprintInputSchema.parse({
    subject: 'synthetic',
    name: 'Blueprint idempotency',
    status: 'active',
    spec: { duration_seconds: 30, slots: [{ count: 1 }] },
  })
  await expect(
    saveBlueprint(input, learner, randomUUID(), undefined, randomUUID()),
  ).rejects.toMatchObject({ status: 403 })
  const key = randomUUID()
  const a = await saveBlueprint(input, admin, randomUUID(), undefined, key)
  bps.push(a.item.id)
  expect(
    (await saveBlueprint(input, admin, randomUUID(), undefined, key)).replayed,
  ).toBe(true)
  await expect(
    saveBlueprint(
      { ...input, name: 'changed' },
      admin,
      randomUUID(),
      undefined,
      key,
    ),
  ).rejects.toMatchObject({ code: 'idempotency_key_mismatch' })
  await saveBlueprint(
    { ...input, name: 'v2', expected_version: 1 },
    admin,
    randomUUID(),
    a.item.id,
  )
  await expect(
    saveBlueprint(
      { ...input, expected_version: 1 },
      admin,
      randomUUID(),
      a.item.id,
    ),
  ).rejects.toMatchObject({ status: 409 })
})
test('mock never reveals feedback before submit; answer editing, flagging, replay and ownership', async () => {
  const bp = await blueprint()
  const { r, key, input } = await mock(bp.id)
  const a = r.attempt
  expect(a.items).toHaveLength(3)
  expect(JSON.stringify(a)).not.toMatch(
    /is_correct|correct_answer|explanation|sources/,
  )
  expect((await createAttempt(input, key, learner)).attempt.items).toEqual(
    a.items,
  )
  expect(await answerItem(a.id, 1, 'A', true, learner)).toEqual({ saved: true })
  expect(await answerItem(a.id, 1, 'B', undefined, learner)).toEqual({
    saved: true,
  })
  await expect(getAttempt(a.id, other)).rejects.toMatchObject({ status: 404 })
  await expect(
    answerItem(a.id, 1, 'A', undefined, other),
  ).rejects.toMatchObject({ status: 404 })
  await expect(submitAttempt(a.id, admin)).rejects.toMatchObject({
    status: 404,
  })
  const final = await submitAttempt(a.id, learner)
  expect(final.feedback).toHaveLength(3)
  expect(final.unanswered).toBe(2)
  expect(await submitAttempt(a.id, learner)).toEqual(final)
  await expect(
    answerItem(a.id, 1, 'C', undefined, learner),
  ).rejects.toMatchObject({ status: 422 })
})
test('late answer is not saved, expired result grades only prior saves and GET finalizes', async () => {
  const bp = await blueprint()
  const { r } = await mock(bp.id)
  const a = r.attempt
  await answerItem(a.id, 1, 'A', undefined, learner)
  await db.query(
    "UPDATE attempts SET deadline_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [a.id],
  )
  const late = await answerItem(a.id, 2, 'A', undefined, learner)
  expect(late).toMatchObject({
    saved: false,
    status: 'expired',
    result: { outcome: 'expired', unanswered: 2 },
  })
  expect((await getAttempt(a.id, learner)).items[1]!.answer).toBeNull()
  expect(await submitAttempt(a.id, learner)).toEqual(
    (late as { result: unknown }).result,
  )
  const second = await mock(bp.id)
  const beforeDeadline = await progress(learner, 'synthetic')
  await db.query(
    "UPDATE attempts SET deadline_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [second.r.attempt.id],
  )
  const afterDeadline = await progress(learner, 'synthetic')
  expect(afterDeadline.items).not.toEqual(beforeDeadline.items)
  expect(
    (
      await db.query('SELECT status FROM attempts WHERE id=$1', [
        second.r.attempt.id,
      ])
    ).rows[0].status,
  ).toBe('in_progress')
  expect((await getAttempt(second.r.attempt.id, learner)).status).toBe(
    'expired',
  )
  expect(await progress(learner, 'synthetic')).toEqual(afterDeadline)
})
test('blueprint edits do not alter existing attempt snapshot/deadline; shortage does not create attempt', async () => {
  const bp = await blueprint()
  const { r } = await mock(bp.id)
  const before = await db.query(
    'SELECT blueprint_snapshot,deadline_at FROM attempts WHERE id=$1',
    [r.attempt.id],
  )
  await saveBlueprint(
    blueprintInputSchema.parse({
      subject: 'synthetic',
      name: 'changed',
      status: 'retired',
      expected_version: 1,
      spec: { duration_seconds: 1, slots: [{ count: 200 }] },
    }),
    admin,
    randomUUID(),
    bp.id,
  )
  const after = await db.query(
    'SELECT blueprint_snapshot,deadline_at FROM attempts WHERE id=$1',
    [r.attempt.id],
  )
  expect(after.rows).toEqual(before.rows)
  const huge = await blueprint(600, 200)
  const beforeCount = await db.query(
    'SELECT count(*) FROM attempts WHERE user_id=$1',
    [learner],
  )
  await expect(mock(huge.id)).rejects.toMatchObject({
    code: 'insufficient_questions',
  })
  expect(
    (
      await db.query('SELECT count(*) FROM attempts WHERE user_id=$1', [
        learner,
      ])
    ).rows,
  ).toEqual(beforeCount.rows)
  expect(
    (await listBlueprints('synthetic')).items.some((b) => b.id === bp.id),
  ).toBe(false)
})
test('progress excludes active mocks; review uses owner/latest results, flags and approved current revisions', async () => {
  const active = await mock((await blueprint()).id)
  await answerItem(active.r.attempt.id, 1, 'A', true, learner)
  expect((await progress(other, 'synthetic')).items).toEqual([])
  const attempt = await createAttempt(
    createAttemptSchema.parse({
      subject: 'synthetic',
      mode: 'practice',
      count: 1,
    }),
    randomUUID(),
    other,
  )
  ids.push(attempt.attempt.id)
  const item = attempt.attempt.items[0]!
  const correct = await db.query(
    'SELECT label FROM question_choices WHERE revision_id=$1 AND is_correct',
    [item.revision_id],
  )
  const wrong = correct.rows[0].label === 'A' ? 'B' : 'A'
  await answerItem(attempt.attempt.id, 1, wrong, true, other)
  await submitAttempt(attempt.attempt.id, other)
  const stats = await progress(other, 'synthetic')
  expect(stats.items.every((row) => row.wrong === 1)).toBe(true)
  const review = await createAttempt(
    createAttemptSchema.parse({
      subject: 'synthetic',
      mode: 'review',
      source: 'flagged',
      count: 1,
    }),
    randomUUID(),
    other,
  )
  ids.push(review.attempt.id)
  expect(review.attempt.items[0]!.question_id).toBe(item.question_id)
  await answerItem(review.attempt.id, 1, correct.rows[0].label, false, other)
  await submitAttempt(review.attempt.id, other)
  await expect(
    createAttempt(
      createAttemptSchema.parse({
        subject: 'synthetic',
        mode: 'review',
        source: 'wrong',
        count: 1,
      }),
      randomUUID(),
      other,
    ),
  ).rejects.toMatchObject({ code: 'insufficient_questions' })
  expect(
    (await progress(other, 'synthetic')).items.every(
      (row) => row.total === 2 && row.correct === 1,
    ),
  ).toBe(true)
  expect(
    (
      await getPool().query(
        'SELECT rolsuper FROM pg_roles WHERE rolname=session_user',
      )
    ).rows[0].rolsuper,
  ).toBe(false)
})

test('practice replay retains the request hash format used before P05', async () => {
  const input = createAttemptSchema.parse({
    subject: 'synthetic',
    mode: 'practice',
    count: 1,
  })
  const key = randomUUID()
  const result = await createAttempt(input, key, other)
  const expected = createHash('sha256')
    .update(
      JSON.stringify({
        subject: 'synthetic',
        mode: 'practice',
        type: 'mcq',
        difficulty: null,
        count: 1,
        topic_ids: [],
      }),
    )
    .digest('hex')
  expect(
    (
      await db.query('SELECT request_hash FROM attempts WHERE id=$1', [
        result.attempt.id,
      ])
    ).rows[0].request_hash,
  ).toBe(expected)
  expect((await createAttempt(input, key, other)).replayed).toBe(true)
})
