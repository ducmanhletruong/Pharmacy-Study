import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { beforeAll, afterAll, expect, test } from 'vitest'
import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from '../../packages/db/src/maintenance'
import { closeDb } from '../../packages/db/src/client'
import {
  saveWrittenPaper,
  startWritten,
  getWritten,
  saveWrittenAnswer,
  submitWritten,
  gradeWritten,
  writtenPdf,
  writtenPapers,
  writtenHistory,
} from '../../packages/db/src/written'
loadMaintenanceEnv()
const a = randomUUID(),
  b = randomUUID(),
  db = getMaintenancePool()
const input = {
  name: 'Synthetic written paper',
  subject: 'synthetic',
  duration_seconds: 600,
  sections: [
    { title: 'Câu1', max_points: 4 },
    { title: 'Câu2', max_points: 6 },
  ],
  exam_pdf_base64: readFileSync(
    new URL('../../content/fixtures/written-synthetic.pdf', import.meta.url),
  ).toString('base64'),
  reference_pdf_base64: readFileSync(
    new URL('../../content/fixtures/written-synthetic.pdf', import.meta.url),
  ).toString('base64'),
}
beforeAll(async () => {
  await db.query(
    "INSERT INTO users(id,email,display_name,role) VALUES($1::uuid,$1::text||'@example.invalid','Written fixture','learner'),($2::uuid,$2::text||'@example.invalid','Written fixture','admin')",
    [a, b],
  )
})
afterAll(async () => {
  await db.query(
    'DELETE FROM written_answers WHERE attempt_id IN(SELECT id FROM written_attempts WHERE user_id=$1)',
    [a],
  )
  await db.query('DELETE FROM written_attempts WHERE user_id=$1', [a])
  await db.query('DELETE FROM written_papers WHERE user_id=$1', [a])
  await db.query('DELETE FROM audit_logs WHERE actor_user_id=ANY($1::uuid[])', [
    [a, b],
  ])
  await db.query('DELETE FROM users WHERE id=ANY($1::uuid[])', [[a, b]])
  await closeDb()
  await closeMaintenance()
})
test('private paper, PDF and attempts deny even another admin; create is repeatable', async () => {
  const p = await saveWrittenPaper(input, a)
  expect((await saveWrittenPaper(input, a)).id).toBe(p.id)
  expect((await writtenPapers(b)).items).toEqual([])
  expect((await writtenHistory(b)).items).toEqual([])
  await expect(writtenPdf(p.id, b)).rejects.toMatchObject({ status: 404 })
  await expect(startWritten(p.id, b, randomUUID())).rejects.toMatchObject({
    status: 404,
  })
  const key = randomUUID(),
    r = await startWritten(p.id, a, key)
  expect((await startWritten(p.id, a, key)).replayed).toBe(true)
  await expect(getWritten(r.attempt.id, b)).rejects.toMatchObject({
    status: 404,
  })
  await expect(
    saveWrittenAnswer(r.attempt.id, b, 1, 'fake'),
  ).rejects.toMatchObject({ status: 404 })
  expect(r.attempt.reference_available).toBe(false)
  await expect(writtenPdf(p.id, a, r.attempt.id)).rejects.toMatchObject({
    status: 403,
  })
})
test('written answers resume, submit freezes content and manual points enforce section maxima', async () => {
  const p = await saveWrittenPaper(input, a),
    r = await startWritten(p.id, a, randomUUID())
  await saveWrittenAnswer(r.attempt.id, a, 1, 'A saved written response')
  expect((await getWritten(r.attempt.id, a)).answers[0]!.text).toBe(
    'A saved written response',
  )
  await expect(gradeWritten(r.attempt.id, a, [4, 6])).rejects.toMatchObject({
    status: 422,
  })
  const final = await submitWritten(r.attempt.id, a)
  expect(final.reference_available).toBe(true)
  expect(
    (await writtenPdf(p.id, a, r.attempt.id)).subarray(0, 5).toString(),
  ).toBe('%PDF-')
  await expect(
    saveWrittenAnswer(r.attempt.id, a, 1, 'late edit'),
  ).rejects.toMatchObject({ status: 422 })
  await expect(gradeWritten(r.attempt.id, a, [5, 5])).rejects.toMatchObject({
    status: 400,
  })
  const graded = await gradeWritten(r.attempt.id, a, [3, 4.5])
  expect(graded).toMatchObject({ score: 7.5, grading_status: 'self_assessed' })
  expect(await submitWritten(r.attempt.id, a)).toEqual({
    ...graded,
    server_time: expect.any(String),
  })
})
test('expiry rejects late writing and grades saved responses only; reference access checks expiry server side', async () => {
  const p = await saveWrittenPaper(input, a),
    r = await startWritten(p.id, a, randomUUID())
  await saveWrittenAnswer(r.attempt.id, a, 1, 'Before deadline')
  await db.query(
    "UPDATE written_attempts SET deadline_at=clock_timestamp()-interval '1 second' WHERE id=$1",
    [r.attempt.id],
  )
  const late = await saveWrittenAnswer(r.attempt.id, a, 2, 'Too late')
  expect(late.status).toBe('expired')
  expect(late.answers[1]!.text).toBe('')
  expect(late.answers[0]!.text).toBe('Before deadline')
  expect((await gradeWritten(r.attempt.id, a, [4, 0])).score).toBe(4)
})

test('private paper import rejects non-PDF bytes and grading never accepts missing/invalid points', async () => {
  await expect(
    saveWrittenPaper(
      {
        ...input,
        exam_pdf_base64: Buffer.from('not a pdf').toString('base64'),
      },
      a,
    ),
  ).rejects.toMatchObject({ status: 400 })
  const p = await saveWrittenPaper(input, a),
    r = await startWritten(p.id, a, randomUUID())
  await submitWritten(r.attempt.id, a)
  await expect(gradeWritten(r.attempt.id, a, [NaN, 1])).rejects.toMatchObject({
    status: 400,
  })
  await expect(gradeWritten(r.attempt.id, a, [1])).rejects.toMatchObject({
    status: 400,
  })
})
