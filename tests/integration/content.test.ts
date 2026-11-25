import { randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import {
  bundleSchema,
  patchQuestionRevisionSchema,
} from '../../packages/api-contract/src/bundle'
import { closeDb } from '../../packages/db/src/client'
import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from '../../packages/db/src/maintenance'
import {
  importBundle,
  questionDetail,
  patchQuestion,
  reviewSource,
  createReport,
  resolveReport,
} from '../../packages/db/src/content'
import { createAttempt, getAttempt } from '../../packages/db/src/practice'
loadMaintenanceEnv()
afterAll(async () => {
  await closeDb()
  await closeMaintenance()
})
type Client = Awaited<
  ReturnType<ReturnType<typeof getMaintenancePool>['connect']>
>
function bundle(subject = `p04-${randomUUID()}`) {
  return bundleSchema.parse({
    schema_version: 1,
    manifest: {
      subject,
      label: 'Synthetic only',
      generator: { name: 'test', version: '1' },
      created_at: '2026-11-19T00:00:00.000Z',
    },
    topics: [{ code: 'root', parent_code: null, title: 'Synthetic root' }],
    sources: [
      {
        ref: 's',
        kind: 'manual',
        title: 'Synthetic author source',
        locator: 'fixture',
        license: 'CC0',
        retrieved_at: '2026-11-19T00:00:00.000Z',
      },
    ],
    assets: [],
    questions: [
      {
        external_id: 'q1',
        type: 'mcq',
        difficulty: 1,
        topic_codes: ['root'],
        stem: 'Synthetic medication safety question for a unit test?',
        choices: [
          { label: 'A', text: 'First', is_correct: true },
          { label: 'B', text: 'Second', is_correct: false },
          { label: 'C', text: 'Third', is_correct: false },
          { label: 'D', text: 'Fourth', is_correct: false },
        ],
        explanation: 'Synthetic explanation only.',
        sources: [{ source_ref: 's', locator: 'fixture' }],
      },
    ],
  })
}
async function actor(c: Client, role: 'admin' | 'learner' = 'admin') {
  const id = randomUUID()
  await c.query(
    'INSERT INTO users(id,email,display_name,role) VALUES($1,$2,$3,$4)',
    [id, `${id}@example.invalid`, 'P04 test actor', role],
  )
  return id
}
async function rollback(
  run: (client: Client, adminId: string) => Promise<void>,
) {
  const c = await getMaintenancePool().connect()
  try {
    await c.query('BEGIN')
    await c.query(
      "SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='3s'",
    )
    await run(c, await actor(c))
  } finally {
    await c.query('ROLLBACK')
    c.release()
  }
}
async function imported(c: Client, adminId: string) {
  const b = bundle()
  const result = await importBundle(b, adminId, randomUUID(), c)
  const row = (
    await c.query(
      'SELECT question_id FROM import_questions WHERE import_id=$1',
      [result.import_id],
    )
  ).rows[0]
  return { b, result, question: await questionDetail(row.question_id, c) }
}
async function approved(c: Client, adminId: string) {
  const f = await imported(c, adminId)
  for (const source of f.question.revision.sources)
    await reviewSource(
      { id: source.id, review_status: 'approved' },
      adminId,
      randomUUID(),
      c,
    )
  let q = await patchQuestion(
    f.question.id,
    { expected_version: f.question.version, status: 'verified' },
    adminId,
    randomUUID(),
    c,
  )
  q = await patchQuestion(
    q.id,
    { expected_version: q.version, status: 'approved' },
    adminId,
    randomUUID(),
    c,
  )
  return { ...f, question: q }
}

test('import is draft with pending provenance, bundle replay is idempotent and content hashes deduplicate across manifests', async () =>
  rollback(async (c, adminId) => {
    const f = await imported(c, adminId)
    expect(f.result.counts).toEqual({ created: 1, duplicates: 0 })
    expect(f.question.status).toBe('draft')
    expect(f.question.version).toBe(1)
    expect(f.question.revision.sources[0].review_status).toBe('pending')
    const replay = await importBundle(f.b, adminId, randomUUID(), c)
    expect(replay.status).toBe('already_imported')
    expect(replay.import_id).toBe(f.result.import_id)
    f.b.manifest.label = 'Different manifest, identical question'
    const topic = f.b.topics[0]!
    const storedOrder = topic.sort_order
    topic.sort_order++
    const duplicate = await importBundle(f.b, adminId, randomUUID(), c)
    expect(duplicate.counts).toEqual({ created: 0, duplicates: 1 })
    const { rows: topics } = await c.query<{ sort_order: number }>(
      'SELECT t.sort_order FROM topics t JOIN subjects s ON s.id=t.subject_id WHERE s.code=$1 AND t.code=$2',
      [f.b.manifest.subject, topic.code],
    )
    expect(topics[0]?.sort_order).toBe(storedOrder)
    const rows = await c.query(
      'SELECT count(*)::int n FROM questions WHERE subject_id=(SELECT id FROM subjects WHERE code=$1)',
      [f.b.manifest.subject],
    )
    expect(rows.rows[0].n).toBe(1)
  }))
test('release requires reviewed sources, never draft to approved, optimistic versions and DB backstop preserve the gates', async () =>
  rollback(async (c, adminId) => {
    const f = await imported(c, adminId),
      q = f.question
    await expect(
      patchQuestion(
        q.id,
        { expected_version: q.version, status: 'approved' },
        adminId,
        randomUUID(),
        c,
      ),
    ).rejects.toMatchObject({ code: 'invalid_state_transition', status: 422 })
    await expect(
      patchQuestion(
        q.id,
        { expected_version: q.version, status: 'verified' },
        adminId,
        randomUUID(),
        c,
      ),
    ).rejects.toMatchObject({ status: 422 })
    await c.query('SAVEPOINT direct_gate')
    await expect(
      c.query("UPDATE questions SET status='verified' WHERE id=$1", [q.id]),
    ).rejects.toMatchObject({ code: '23514' })
    await c.query('ROLLBACK TO SAVEPOINT direct_gate')
    await reviewSource(
      { id: q.revision.sources[0].id, review_status: 'approved' },
      adminId,
      randomUUID(),
      c,
    )
    const verified = await patchQuestion(
      q.id,
      { expected_version: q.version, status: 'verified' },
      adminId,
      randomUUID(),
      c,
    )
    await expect(
      patchQuestion(
        q.id,
        { expected_version: q.version, status: 'approved' },
        adminId,
        randomUUID(),
        c,
      ),
    ).rejects.toMatchObject({ code: 'version_conflict', status: 409 })
    expect(
      (
        await patchQuestion(
          q.id,
          { expected_version: verified.version, status: 'approved' },
          adminId,
          randomUUID(),
          c,
        )
      ).status,
    ).toBe('approved')
  }))
test('content edits create a new draft revision while attempts retain the approved original', async () =>
  rollback(async (c, adminId) => {
    const f = await approved(c, adminId),
      q = f.question
    const created = await createAttempt(
      {
        subject: f.b.manifest.subject,
        mode: 'practice',
        type: 'mcq',
        count: 1,
      },
      randomUUID(),
      adminId,
      randomUUID(),
      c,
    )
    const revision = patchQuestionRevisionSchema.parse({
      stem: f.b.questions[0].stem,
      explanation: f.b.questions[0].explanation,
      difficulty: 1,
      choices: f.b.questions[0].choices,
      topic_codes: f.b.questions[0].topic_codes,
      sources: q.revision.sources.map((s) => ({
        source_id: s.id,
        locator: s.locator,
      })),
    })
    revision.stem += ' Revised copy.'
    const edited = await patchQuestion(
      q.id,
      { expected_version: q.version, revision },
      adminId,
      randomUUID(),
      c,
    )
    expect(edited.status).toBe('draft')
    expect(edited.revision.id).not.toBe(q.revision.id)
    expect(edited.history).toHaveLength(2)
    expect(
      (await getAttempt(created.attempt.id, adminId, c)).items[0].revision_id,
    ).toBe(q.revision.id)
    expect(
      (await getAttempt(created.attempt.id, adminId, c)).items[0].stem,
    ).toBe(q.revision.stem)
  }))
test('source rejection atomically quarantines released questions without rewriting old source snapshots', async () =>
  rollback(async (c, adminId) => {
    const f = await approved(c, adminId),
      q = f.question
    const before = (
      await c.query('SELECT payload FROM question_revisions WHERE id=$1', [
        q.revision.id,
      ])
    ).rows[0].payload
    await reviewSource(
      { id: q.revision.sources[0].id, review_status: 'rejected' },
      adminId,
      randomUUID(),
      c,
    )
    expect((await questionDetail(q.id, c)).status).toBe('under_review')
    expect(
      (
        await c.query('SELECT payload FROM question_revisions WHERE id=$1', [
          q.revision.id,
        ])
      ).rows[0].payload,
    ).toEqual(before)
    await expect(
      createAttempt(
        {
          subject: f.b.manifest.subject,
          mode: 'practice',
          type: 'mcq',
          count: 1,
        },
        randomUUID(),
        adminId,
        randomUUID(),
        c,
      ),
    ).rejects.toMatchObject({ code: 'insufficient_questions' })
  }))
test('reports require an owned attempt, deduplicate open submissions, quarantine and resolve without auto-approval', async () =>
  rollback(async (c, adminId) => {
    const f = await approved(c, adminId),
      q = f.question,
      learner = await actor(c, 'learner')
    await c.query("UPDATE sources SET audience='public' WHERE id=$1", [
      q.revision.sources[0].id,
    ])
    await expect(
      createReport(q.id, { reason: 'typo' }, learner, randomUUID(), c),
    ).rejects.toMatchObject({ status: 403 })
    await createAttempt(
      {
        subject: f.b.manifest.subject,
        mode: 'practice',
        type: 'mcq',
        count: 1,
      },
      randomUUID(),
      learner,
      randomUUID(),
      c,
    )
    const first = await createReport(
      q.id,
      { reason: 'typo', revision_id: q.revision.id },
      learner,
      randomUUID(),
      c,
    )
    expect(
      (
        await createReport(
          q.id,
          { reason: 'wrong_answer' },
          learner,
          randomUUID(),
          c,
        )
      ).id,
    ).toBe(first.id)
    expect((await questionDetail(q.id, c)).status).toBe('under_review')
    await expect(
      resolveReport(first.id, { status: 'resolved' }, learner, randomUUID(), c),
    ).rejects.toMatchObject({ status: 403 })
    expect(
      (
        await resolveReport(
          first.id,
          { status: 'resolved', note: 'Reviewed' },
          adminId,
          randomUUID(),
          c,
        )
      ).status,
    ).toBe('resolved')
    expect((await questionDetail(q.id, c)).status).toBe('under_review')
    expect(
      (
        await resolveReport(
          first.id,
          { status: 'resolved' },
          adminId,
          randomUUID(),
          c,
        )
      ).status,
    ).toBe('resolved')
  }))
test('direct importer validates unsafe assets before any database mutation and learners cannot import', async () =>
  rollback(async (c, adminId) => {
    const b = bundle(),
      malicious = {
        ref: 'unsafe',
        kind: 'svg',
        data_base64: Buffer.from(
          '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        ).toString('base64'),
        license: 'CC0',
        attribution: 'Synthetic test',
        alt_text: 'Unsafe fixture',
        source_ref: 's',
      }
    await expect(
      importBundle(
        {
          ...b,
          assets: [malicious],
          questions: b.questions.map((q) => ({ ...q, asset_refs: ['unsafe'] })),
        },
        adminId,
        randomUUID(),
        c,
      ),
    ).rejects.toMatchObject({ code: 'bundle_invalid', status: 422 })
    const count = await c.query(
      'SELECT count(*)::int n FROM subjects WHERE code=$1',
      [b.manifest.subject],
    )
    expect(count.rows[0].n).toBe(0)
    await expect(
      importBundle(b, await actor(c, 'learner'), randomUUID(), c),
    ).rejects.toMatchObject({ status: 403 })
  }))
test('similar stems produce warnings while both distinct questions remain separate drafts', async () =>
  rollback(async (c, adminId) => {
    const f = await imported(c, adminId)
    f.b.manifest.label = 'Second'
    f.b.questions[0].stem += ' Please explain.'
    const second = await importBundle(f.b, adminId, randomUUID(), c)
    expect(second.counts).toEqual({ created: 1, duplicates: 0 })
    expect(second.report.near_duplicates.length).toBeGreaterThan(0)
    const count = await c.query(
      "SELECT count(*)::int n FROM questions q JOIN subjects s ON s.id=q.subject_id WHERE s.code=$1 AND q.status='draft'",
      [f.b.manifest.subject],
    )
    expect(count.rows[0].n).toBe(2)
  }))

async function cleanupCommittedBank(subject: string, adminId: string) {
  const c = await getMaintenancePool().connect()
  try {
    await c.query('BEGIN')
    await c.query(
      "SET LOCAL statement_timeout='8s'; SET LOCAL lock_timeout='3s'",
    )
    const bank = (
      await c.query('SELECT id FROM subjects WHERE code=$1', [subject])
    ).rows[0]
    if (bank) {
      const id = bank.id
      await c.query(
        'DELETE FROM import_questions WHERE import_id IN (SELECT id FROM imports WHERE uploaded_by=$1)',
        [adminId],
      )
      await c.query('DELETE FROM question_content_hashes WHERE subject_id=$1', [
        id,
      ])
      await c.query(
        'UPDATE questions SET current_revision_id=NULL WHERE subject_id=$1',
        [id],
      )
      for (const table of [
        'question_sources',
        'question_assets',
        'accepted_answers',
      ])
        await c.query(
          `DELETE FROM ${table} WHERE revision_id IN (SELECT r.id FROM question_revisions r JOIN questions q ON q.id=r.question_id WHERE q.subject_id=$1)`,
          [id],
        )
      await c.query('DELETE FROM question_topics WHERE subject_id=$1', [id])
      await c.query(
        'DELETE FROM question_choices WHERE revision_id IN (SELECT r.id FROM question_revisions r JOIN questions q ON q.id=r.question_id WHERE q.subject_id=$1)',
        [id],
      )
      await c.query(
        'DELETE FROM question_revisions WHERE question_id IN (SELECT id FROM questions WHERE subject_id=$1)',
        [id],
      )
      await c.query('DELETE FROM questions WHERE subject_id=$1', [id])
      await c.query('DELETE FROM topics WHERE subject_id=$1', [id])
      await c.query('DELETE FROM sources WHERE subject_id=$1', [id])
      await c.query('DELETE FROM subjects WHERE id=$1', [id])
    }
    await c.query('DELETE FROM imports WHERE uploaded_by=$1', [adminId])
    await c.query('DELETE FROM audit_logs WHERE actor_user_id=$1', [adminId])
    await c.query('DELETE FROM users WHERE id=$1', [adminId])
    await c.query('COMMIT')
  } catch (error) {
    await c.query('ROLLBACK')
    throw error
  } finally {
    c.release()
  }
}
test('concurrent HTTP-equivalent import transactions commit one bundle and no duplicate questions', async () => {
  const c = await getMaintenancePool().connect(),
    b = bundle()
  let adminId = ''
  try {
    adminId = await actor(c)
    const responses = await Promise.all([
      importBundle(b, adminId, randomUUID()),
      importBundle(b, adminId, randomUUID()),
    ])
    expect(responses.map((result) => result.status).sort()).toEqual([
      'already_imported',
      'imported',
    ])
    expect(responses[0].import_id).toBe(responses[1].import_id)
    const counts = await c.query(
      'SELECT count(*)::int n FROM questions q JOIN subjects s ON s.id=q.subject_id WHERE s.code=$1',
      [b.manifest.subject],
    )
    expect(counts.rows[0].n).toBe(1)
  } finally {
    c.release()
    if (adminId) await cleanupCommittedBank(b.manifest.subject, adminId)
  }
})
test('a mid-import topic conflict rolls back newly inserted topics and the import record', async () => {
  const c = await getMaintenancePool().connect(),
    b = bundle()
  let adminId = ''
  try {
    adminId = await actor(c)
    const subject = (
      await c.query(
        'INSERT INTO subjects(code,name) VALUES($1,$1) RETURNING id',
        [b.manifest.subject],
      )
    ).rows[0].id
    await c.query(
      "INSERT INTO topics(subject_id,code,title) VALUES($1,'root','Existing different title')",
      [subject],
    )
    b.topics.push({
      code: 'new-before-conflict',
      title: 'Will rollback',
      parent_code: null,
      sort_order: 0,
    })
    await expect(importBundle(b, adminId, randomUUID())).rejects.toMatchObject({
      code: 'topic_conflict',
      status: 409,
    })
    expect(
      (
        await c.query(
          "SELECT count(*)::int n FROM topics WHERE subject_id=$1 AND code='new-before-conflict'",
          [subject],
        )
      ).rows[0].n,
    ).toBe(0)
    expect(
      (
        await c.query(
          'SELECT count(*)::int n FROM imports WHERE uploaded_by=$1',
          [adminId],
        )
      ).rows[0].n,
    ).toBe(0)
  } finally {
    c.release()
    if (adminId) await cleanupCommittedBank(b.manifest.subject, adminId)
  }
})
