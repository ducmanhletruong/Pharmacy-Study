import { loadLocalEnv } from '../../packages/db/src/env'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, expect, test } from 'vitest'
import { DEV_USER_ID, getPool, closeDb } from '../../packages/db/src/client'
import { getAttempt } from '../../packages/db/src/practice'
import {
  attemptSchema,
  feedbackSchema,
  resultSchema,
  subjectSchema,
} from '../../packages/api-contract/src'
import { assertAuthMode } from '../../apps/web/src/config'
import { GET as list } from '../../apps/web/src/app/api/v1/subjects/route'
import { GET as tree } from '../../apps/web/src/app/api/v1/subjects/[code]/topics/route'
import { POST as create } from '../../apps/web/src/app/api/v1/attempts/route'
import { GET as read } from '../../apps/web/src/app/api/v1/attempts/[id]/route'
import { PUT as answer } from '../../apps/web/src/app/api/v1/attempts/[id]/items/[position]/route'
import { POST as submit } from '../../apps/web/src/app/api/v1/attempts/[id]/submit/route'

loadLocalEnv()
const ids: string[] = []
const origin = 'http://localhost:3000'
const context = (id: string) => ({ params: Promise.resolve({ id }) })
function req(
  path: string,
  method = 'GET',
  body?: unknown,
  key = randomUUID(),
  requestOrigin = origin,
) {
  return new Request(origin + '/api/v1' + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Origin: requestOrigin,
      'Idempotency-Key': key,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}
async function newAttempt(key = randomUUID(), extra = {}) {
  const response = await create(
    req(
      '/attempts',
      'POST',
      { subject: 'synthetic', mode: 'practice', count: 10, ...extra },
      key,
    ),
  )
  const value = await response.json()
  if (response.ok) ids.push(value.id)
  return { response, value }
}
beforeAll(() => {
  process.env.AUTH_MODE = 'dev'
})
afterAll(async () => {
  await getPool().query(
    'DELETE FROM attempt_items WHERE attempt_id=ANY($1::uuid[])',
    [ids],
  )
  await getPool().query('DELETE FROM attempts WHERE id=ANY($1::uuid[])', [ids])
  await closeDb()
})
test('contracts API-01/02 expose subject counts and a topic tree', async () => {
  const response = await list(req('/subjects'))
  expect(response.status).toBe(200)
  const data = await response.json()
  expect(
    subjectSchema.parse(
      data.items.find((item: { code: string }) => item.code === 'synthetic'),
    ).question_count,
  ).toBe(10)
  const topics = await tree(req('/subjects/synthetic/topics'), {
    params: Promise.resolve({ code: 'synthetic' }),
  })
  const nodes = (await topics.json()).items
  expect(nodes[0].children).toHaveLength(2)
  const parent = await newAttempt(randomUUID(), { topic_ids: [nodes[0].id] })
  expect(parent.response.status).toBe(201)
})
test('API-03/04 redact answers and replay concurrent creates without duplicates', async () => {
  const key = randomUUID()
  const [first, second] = await Promise.all([newAttempt(key), newAttempt(key)])
  expect([first.response.status, second.response.status].sort()).toEqual([
    200, 201,
  ])
  expect(first.value.id).toBe(second.value.id)
  expect([
    first.response.headers.get('Idempotent-Replay'),
    second.response.headers.get('Idempotent-Replay'),
  ]).toContain('true')
  expect(attemptSchema.parse(first.value).items).toHaveLength(10)
  expect(JSON.stringify(first.value)).not.toMatch(
    /is_correct|correct_answer|explanation|sources/,
  )
  const replay = await read(
    req(`/attempts/${first.value.id}`),
    context(first.value.id),
  )
  expect(await replay.json()).toEqual(first.value)
  const equivalent = await newAttempt(key, { topic_ids: [] })
  expect(equivalent.response.status).toBe(200)
  expect(equivalent.value.id).toBe(first.value.id)
  const mismatch = await newAttempt(key, { count: 5 })
  expect(mismatch.response.status).toBe(422)
  expect(mismatch.value.error.code).toBe('idempotency_key_mismatch')
})
test('rejects unavailable banks, unsupported modes and unknown topics before writing attempts', async () => {
  expect(
    (await newAttempt(randomUUID(), { difficulty: 3 })).response.status,
  ).toBe(422)
  expect(
    (await newAttempt(randomUUID(), { mode: 'mock' })).response.status,
  ).toBe(400)
  expect(
    (await newAttempt(randomUUID(), { topic_ids: [randomUUID()] })).response
      .status,
  ).toBe(400)
  expect(
    (
      await create(
        req(
          '/attempts',
          'POST',
          { subject: 'synthetic', mode: 'practice' },
          '',
        ),
      )
    ).status,
  ).toBe(400)
})
test('API-05 is owner-scoped, checks Origin and rejects invalid answers and positions', async () => {
  const { value: attempt } = await newAttempt()
  await expect(getAttempt(attempt.id, randomUUID())).rejects.toMatchObject({
    status: 404,
  })
  const ctx = { params: Promise.resolve({ id: attempt.id, position: '1' }) }
  expect(
    (
      await answer(
        req(
          '/items/1',
          'PUT',
          { answer: 'A' },
          randomUUID(),
          'https://untrusted.invalid',
        ),
        ctx,
      )
    ).status,
  ).toBe(403)
  expect(
    (await answer(req('/items/1', 'PUT', { answer: 'E' }), ctx)).status,
  ).toBe(400)
  expect(
    (
      await answer(req('/items/0', 'PUT', { answer: 'A' }), {
        params: Promise.resolve({ id: attempt.id, position: '0' }),
      })
    ).status,
  ).toBe(400)
  expect(
    (
      await answer(req('/items/99', 'PUT', { answer: 'A' }), {
        params: Promise.resolve({ id: attempt.id, position: '99' }),
      })
    ).status,
  ).toBe(404)
  const noOrigin = new Request(origin + '/api/v1/items/1', {
    method: 'PUT',
    body: JSON.stringify({ answer: 'A' }),
  })
  expect((await answer(noOrigin, ctx)).status).toBe(403)
  const normalized = new Request('http://0.0.0.0:3000/api/v1/items/1', {
    method: 'PUT',
    headers: { Host: '127.0.0.1:3000', Origin: 'http://127.0.0.1:3000' },
    body: JSON.stringify({ answer: 'A' }),
  })
  expect((await answer(normalized, ctx)).status).toBe(200)
  const rebinding = new Request('http://0.0.0.0:3000/api/v1/items/1', {
    method: 'PUT',
    headers: {
      Host: 'untrusted.invalid:3000',
      Origin: 'http://untrusted.invalid:3000',
    },
    body: JSON.stringify({ answer: 'A' }),
  })
  expect((await answer(rebinding, ctx)).status).toBe(403)
})
test('API-05/06 grade the pinned revision, serialize competing answers and freeze submitted attempts', async () => {
  const { value: attempt } = await newAttempt()
  const item = attempt.items[0]
  const revision = await getPool().query(
    'SELECT label FROM question_choices WHERE revision_id=$1 AND is_correct',
    [item.revision_id],
  )
  const correct = revision.rows[0].label
  const ctx = { params: Promise.resolve({ id: attempt.id, position: '1' }) }
  const [a, b] = await Promise.all([
    answer(req('/items/1', 'PUT', { answer: correct }), ctx),
    answer(
      req('/items/1', 'PUT', { answer: correct === 'A' ? 'B' : 'A' }),
      ctx,
    ),
  ])
  expect([a.status, b.status].sort()).toEqual([200, 422])
  const feedback = feedbackSchema.parse(await (a.ok ? a : b).json())
  const saved = await getAttempt(attempt.id, DEV_USER_ID)
  const repeated = await answer(
    req('/items/1', 'PUT', { answer: saved.items[0]!.answer }),
    ctx,
  )
  expect(feedbackSchema.parse(await repeated.json())).toEqual(feedback)
  const result = resultSchema.parse(
    await (await submit(req('/submit', 'POST'), context(attempt.id))).json(),
  )
  expect(result.total).toBe(10)
  expect(result.unanswered).toBe(9)
  expect(result.score).toBe(result.correct)
  expect(result.by_topic.reduce((sum, topic) => sum + topic.total, 0)).toBe(10)
  expect(
    await (await submit(req('/submit', 'POST'), context(attempt.id))).json(),
  ).toEqual(result)
  expect(
    (
      await answer(req('/items/2', 'PUT', { answer: 'A' }), {
        params: Promise.resolve({ id: attempt.id, position: '2' }),
      })
    ).status,
  ).toBe(422)
  const publicAttempt = await getAttempt(attempt.id, DEV_USER_ID)
  expect(publicAttempt.status).toBe('submitted')
  expect(JSON.stringify(publicAttempt)).not.toMatch(
    /is_correct|correct_answer|explanation|sources/,
  )
})
test('attempts remain attached to the original revision if current revision changes', async () => {
  const { value: attempt } = await newAttempt(randomUUID(), { count: 1 })
  const item = attempt.items[0],
    rid = randomUUID()
  await getPool().query(
    "INSERT INTO question_revisions(id,question_id,rev_no,stem,explanation,content_hash,created_by) VALUES($1,$2,999,'temporary revision','test-only',$3,$4)",
    [rid, item.question_id, randomUUID(), DEV_USER_ID],
  )
  try {
    await getPool().query(
      'UPDATE questions SET current_revision_id=$1 WHERE id=$2',
      [rid, item.question_id],
    )
    expect(
      (await getAttempt(attempt.id, DEV_USER_ID)).items[0]!.revision_id,
    ).toBe(item.revision_id)
    expect((await getAttempt(attempt.id, DEV_USER_ID)).items[0]!.stem).toBe(
      item.stem,
    )
  } finally {
    await getPool().query(
      'UPDATE questions SET current_revision_id=$1 WHERE id=$2',
      [item.revision_id, item.question_id],
    )
    await getPool().query('DELETE FROM question_revisions WHERE id=$1', [rid])
  }
})
test('dev identity is unavailable without dev mode and production rejects its configuration', async () => {
  process.env.AUTH_MODE = 'disabled'
  try {
    expect((await list(req('/subjects'))).status).toBe(401)
  } finally {
    process.env.AUTH_MODE = 'dev'
  }
  expect(() =>
    assertAuthMode({ AUTH_MODE: 'dev', NODE_ENV: 'production' }),
  ).toThrow(/forbidden/)
  expect(() =>
    assertAuthMode({ AUTH_MODE: 'disabled', NODE_ENV: 'production' }),
  ).not.toThrow()
})
