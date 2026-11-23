import { randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import { DEV_USER_ID, closeDb } from '../../packages/db/src/client'
import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from '../../packages/db/src/maintenance'
import { createAttempt, submitAttempt } from '../../packages/db/src/practice'

loadMaintenanceEnv()
afterAll(async () => {
  await closeDb()
  await closeMaintenance()
})
type Client = Awaited<
  ReturnType<ReturnType<typeof getMaintenancePool>['connect']>
>
async function rollback(run: (client: Client) => Promise<void>) {
  const client = await getMaintenancePool().connect()
  try {
    await client.query('BEGIN')
    await client.query(
      "SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'",
    )
    await run(client)
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}
async function questionFixture(c: Client) {
  const subject = randomUUID(),
    question = randomUUID(),
    revision = randomUUID(),
    code = `history-${subject}`
  await c.query(
    "INSERT INTO subjects(id,code,name) VALUES($1,$2,'history fixture')",
    [subject, code],
  )
  await c.query(
    "INSERT INTO questions(id,subject_id,type,difficulty,status) VALUES($1,$2,'mcq',1,'draft')",
    [question, subject],
  )
  await addRevision(c, question, revision, 1)
  await c.query('UPDATE questions SET current_revision_id=$1 WHERE id=$2', [
    revision,
    question,
  ])
  const source = randomUUID()
  await c.query(
    "INSERT INTO sources(id,subject_id,kind,title,locator,license,review_status,retrieved_at,fingerprint) VALUES($1,$2,'manual','history fixture','fixture','CC0','approved',now(),$3)",
    [source, subject, randomUUID()],
  )
  await c.query(
    "INSERT INTO question_sources(revision_id,source_id,locator) VALUES($1,$2,'fixture')",
    [revision, source],
  )
  return { subject, question, revision, code }
}
async function addRevision(
  c: Client,
  question: string,
  revision: string,
  number: number,
) {
  await c.query(
    "INSERT INTO question_revisions(id,question_id,rev_no,stem,explanation,content_hash,created_by) VALUES($1,$2,$3,'fixture','fixture',$4,$5)",
    [revision, question, number, randomUUID(), DEV_USER_ID],
  )
  for (const label of ['A', 'B', 'C', 'D'])
    await c.query(
      'INSERT INTO question_choices(revision_id,label,text,is_correct) VALUES($1,$2,$3,$4)',
      [revision, label, `${number}-${label}`, label === 'A'],
    )
}
async function rejectAtSavepoint(
  c: Client,
  query: string,
  args: unknown[],
  code = '23001',
) {
  await c.query('SAVEPOINT expected_failure')
  await expect(c.query(query, args)).rejects.toMatchObject({ code })
  await c.query('ROLLBACK TO SAVEPOINT expected_failure')
}

test('verification and replacement seals survive status rollback and current revision rewind', async () => {
  await rollback(async (c) => {
    const f = await questionFixture(c)
    await c.query("UPDATE questions SET status='verified' WHERE id=$1", [
      f.question,
    ])
    await c.query("UPDATE questions SET status='draft' WHERE id=$1", [
      f.question,
    ])
    await rejectAtSavepoint(
      c,
      "UPDATE question_revisions SET explanation='rewrite' WHERE id=$1",
      [f.revision],
    )
    await rejectAtSavepoint(
      c,
      "UPDATE question_choices SET text='rewrite' WHERE revision_id=$1 AND label='B'",
      [f.revision],
    )
    const draft = await questionFixture(c),
      next = randomUUID()
    await addRevision(c, draft.question, next, 2)
    await c.query('UPDATE questions SET current_revision_id=$1 WHERE id=$2', [
      next,
      draft.question,
    ])
    await c.query('UPDATE questions SET current_revision_id=$1 WHERE id=$2', [
      draft.revision,
      draft.question,
    ])
    await rejectAtSavepoint(
      c,
      "UPDATE question_revisions SET explanation='rewrite' WHERE id=$1",
      [draft.revision],
    )
    await c.query('UPDATE questions SET current_revision_id=NULL WHERE id=$1', [
      draft.question,
    ])
    await rejectAtSavepoint(c, 'DELETE FROM question_revisions WHERE id=$1', [
      draft.revision,
    ])
  })
})
test('the current unattempted draft remains editable and attempt seals persist after the reference is removed', async () => {
  await rollback(async (c) => {
    const f = await questionFixture(c)
    await c.query(
      "UPDATE question_revisions SET explanation='editable' WHERE id=$1",
      [f.revision],
    )
    await c.query('UPDATE questions SET current_revision_id=NULL WHERE id=$1', [
      f.question,
    ])
    await c.query(
      "UPDATE question_choices SET text='still editable' WHERE revision_id=$1 AND label='B'",
      [f.revision],
    )
    const attempt = randomUUID()
    await c.query(
      "INSERT INTO attempts(id,user_id,subject_id,mode,idempotency_key,request_hash) VALUES($1,$2,$3,'practice',$4,'fixture')",
      [attempt, DEV_USER_ID, f.subject, randomUUID()],
    )
    await c.query(
      'INSERT INTO attempt_items(attempt_id,position,question_revision_id) VALUES($1,1,$2)',
      [attempt, f.revision],
    )
    await c.query('DELETE FROM attempt_items WHERE attempt_id=$1', [attempt])
    await rejectAtSavepoint(
      c,
      "UPDATE question_revisions SET explanation='rewrite' WHERE id=$1",
      [f.revision],
    )
  })
})
test('an unattempted draft candidate can become current before deferred validation without being falsely sealed', async () => {
  await rollback(async (c) => {
    const f = await questionFixture(c),
      next = randomUUID()
    await addRevision(c, f.question, next, 2)
    await c.query('UPDATE questions SET current_revision_id=$1 WHERE id=$2', [
      next,
      f.question,
    ])
    await c.query('SET CONSTRAINTS ALL IMMEDIATE')
    await c.query(
      "UPDATE question_revisions SET explanation='new current is editable' WHERE id=$1",
      [next],
    )
  })
})
test('topic cycles of length two and three are rejected while normal reparenting remains valid', async () => {
  await rollback(async (c) => {
    const { subject } = await questionFixture(c),
      a = randomUUID(),
      b = randomUUID(),
      d = randomUUID()
    for (const [id, parent, code] of [
      [a, null, 'a'],
      [b, a, 'b'],
      [d, b, 'd'],
    ])
      await c.query(
        'INSERT INTO topics(id,subject_id,parent_id,code,title) VALUES($1,$2,$3,$4,$4)',
        [id, subject, parent, code],
      )
    await rejectAtSavepoint(
      c,
      'UPDATE topics SET parent_id=$1 WHERE id=$2',
      [b, a],
      '23514',
    )
    await rejectAtSavepoint(
      c,
      'UPDATE topics SET parent_id=$1 WHERE id=$2',
      [d, a],
      '23514',
    )
    await c.query('UPDATE topics SET parent_id=$1 WHERE id=$2', [a, d])
  })
})
for (const isolation of ['READ COMMITTED', 'REPEATABLE READ'])
  test(`concurrent inverse topic moves cannot commit a cycle at ${isolation}`, async () => {
    const pool = getMaintenancePool(),
      subject = randomUUID(),
      a = randomUUID(),
      b = randomUUID(),
      setup = await pool.connect()
    const first = await pool.connect(),
      second = await pool.connect()
    try {
      await setup.query('BEGIN')
      await setup.query(
        "INSERT INTO subjects(id,code,name) VALUES($1,$2,'cycle fixture')",
        [subject, `cycle-${subject}`],
      )
      for (const [id, code] of [
        [a, 'a'],
        [b, 'b'],
      ])
        await setup.query(
          'INSERT INTO topics(id,subject_id,code,title) VALUES($1,$2,$3,$3)',
          [id, subject, code],
        )
      await setup.query('COMMIT')
      for (const c of [first, second]) {
        await c.query(`BEGIN ISOLATION LEVEL ${isolation}`)
        await c.query(
          "SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'",
        )
      }
      await second.query('SELECT id FROM topics WHERE subject_id=$1', [subject])
      await first.query('UPDATE topics SET parent_id=$1 WHERE id=$2', [b, a])
      const blocked = second
        .query('UPDATE topics SET parent_id=$1 WHERE id=$2', [a, b])
        .then(
          () => ({ code: 'unexpected_success' }),
          (error: unknown) => ({ code: (error as { code: string }).code }),
        )
      await new Promise((resolve) => setTimeout(resolve, 30))
      await first.query('COMMIT')
      expect((await blocked).code).toBe(
        isolation === 'READ COMMITTED' ? '23514' : '40001',
      )
      await second.query('ROLLBACK')
      const rows = await setup.query(
        'SELECT id,parent_id FROM topics WHERE subject_id=$1 ORDER BY id',
        [subject],
      )
      expect(rows.rows.find((row) => row.id === a)?.parent_id).toBe(b)
      expect(rows.rows.find((row) => row.id === b)?.parent_id).toBeNull()
    } finally {
      await first.query('ROLLBACK')
      await second.query('ROLLBACK')
      first.release()
      second.release()
      await setup.query('ROLLBACK')
      await setup.query('BEGIN')
      await setup.query('DELETE FROM topics WHERE subject_id=$1', [subject])
      await setup.query('DELETE FROM subjects WHERE id=$1', [subject])
      await setup.query('COMMIT')
      setup.release()
    }
  })
test('attempt snapshots preserve all original topic names and membership across rename, reparent, retag and submit replay', async () => {
  await rollback(async (c) => {
    const f = await questionFixture(c),
      a = randomUUID(),
      b = randomUUID(),
      replacement = randomUUID()
    for (const [id, code, title] of [
      [a, 'a', 'Original A'],
      [b, 'b', 'Original B'],
      [replacement, 'c', 'Replacement'],
    ])
      await c.query(
        'INSERT INTO topics(id,subject_id,code,title) VALUES($1,$2,$3,$4)',
        [id, f.subject, code, title],
      )
    for (const topic of [a, b])
      await c.query(
        'INSERT INTO question_topics(question_id,topic_id,subject_id) VALUES($1,$2,$3)',
        [f.question, topic, f.subject],
      )
    await c.query("UPDATE questions SET status='verified' WHERE id=$1", [
      f.question,
    ])
    await c.query("UPDATE questions SET status='approved' WHERE id=$1", [
      f.question,
    ])
    const created = await createAttempt(
      { subject: f.code, mode: 'practice', type: 'mcq', count: 1 },
      randomUUID(),
      DEV_USER_ID,
      randomUUID(),
      c,
    )
    const attempt = created.attempt.id
    const snapshot = await c.query(
      'SELECT topic_snapshot,topic_snapshot_origin FROM attempt_items WHERE attempt_id=$1',
      [attempt],
    )
    expect(snapshot.rows[0].topic_snapshot_origin).toBe('captured')
    expect(
      snapshot.rows[0].topic_snapshot.map(
        (topic: { title: string }) => topic.title,
      ),
    ).toEqual(['Original A', 'Original B'])
    await rejectAtSavepoint(
      c,
      "UPDATE attempt_items SET topic_snapshot='[]' WHERE attempt_id=$1",
      [attempt],
    )
    await rejectAtSavepoint(
      c,
      'UPDATE attempt_items SET position=2 WHERE attempt_id=$1',
      [attempt],
    )
    await c.query(
      "UPDATE topics SET title='Renamed',parent_id=$1 WHERE id=$2",
      [replacement, a],
    )
    await c.query('DELETE FROM question_topics WHERE question_id=$1', [
      f.question,
    ])
    await c.query(
      'INSERT INTO question_topics(question_id,topic_id,subject_id) VALUES($1,$2,$3)',
      [f.question, replacement, f.subject],
    )
    const result = await submitAttempt(attempt, DEV_USER_ID, randomUUID(), c)
    expect(
      result.by_topic.map((topic) => ({
        id: topic.topic_id,
        title: topic.title,
        total: topic.total,
      })),
    ).toEqual([
      { id: a, title: 'Original A', total: 1 },
      { id: b, title: 'Original B', total: 1 },
    ])
    expect(result.total).toBe(1)
    await c.query("UPDATE topics SET title='Renamed again' WHERE id=$1", [b])
    expect(await submitAttempt(attempt, DEV_USER_ID, randomUUID(), c)).toEqual(
      result,
    )
  })
})

for (const length of [2, 3])
  test(`multi-row insertion cannot close a ${length}-topic cycle through the not-yet-visible current row`, async () => {
    await rollback(async (client) => {
      const { subject } = await questionFixture(client)
      const ids = Array.from({ length }, () => randomUUID())
      const args: string[] = []
      const values = ids.map((id, index) => {
        args.push(id, subject, ids[(index + 1) % length]!, `bulk-${index}`)
        const base = index * 4
        return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 4})`
      })
      await expect(
        client.query(
          `INSERT INTO topics(id,subject_id,parent_id,code,title) VALUES ${values.join(',')}`,
          args,
        ),
      ).rejects.toMatchObject({ code: '23514' })
    })
  })
