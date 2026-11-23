import {
  assembleExam,
  InsufficientQuestions,
  type Candidate,
} from '@pharmacy/core/exam'
import { blueprintSpecSchema } from '@pharmacy/api-contract'
import { createHash, randomUUID } from 'node:crypto'
import { appendAudit } from './audit'
import type pg from 'pg'
import { sql } from 'drizzle-orm'
import { gradeMcq, type Choice, type Label } from '@pharmacy/core'
import {
  attemptSchema,
  feedbackSchema,
  resultSchema,
  subjectSchema,
  topicSchema,
  type CreateAttempt,
} from '@pharmacy/api-contract'
import { getPool, getDb } from './client'

export class PracticeError extends Error {
  retryAfter?: number
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message)
  }
}
type Db = Pick<pg.PoolClient, 'query'>
async function transaction<T>(
  run: (client: pg.PoolClient) => Promise<T>,
  context?: pg.PoolClient,
) {
  // Maintenance/tests can include the service in an existing transaction.
  if (context) return run(context)
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const value = await run(client)
    await client.query('COMMIT')
    return value
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
export async function subjects() {
  const result = await getDb().execute(
    sql`SELECT s.id,s.code,s.name,count(q.id)::int AS question_count FROM subjects s LEFT JOIN questions q ON q.subject_id=s.id AND q.status='approved' GROUP BY s.id ORDER BY s.code`,
  )
  return {
    items: result.rows.map((row) => subjectSchema.parse(row)),
    next_cursor: null,
  }
}
export async function topics(code: string, db: Db = getPool()) {
  const subject = await db.query('SELECT id FROM subjects WHERE code=$1', [
    code,
  ])
  if (!subject.rows[0])
    throw new PracticeError('not_found', 404, 'Không tìm thấy môn học')
  const result = await db.query(
    'SELECT id,parent_id,code,title,sort_order FROM topics WHERE subject_id=$1 ORDER BY sort_order,code',
    [subject.rows[0].id],
  )
  const rows = result.rows.map((row) => topicSchema.parse(row))
  type Tree = (typeof rows)[number] & { children: Tree[] }
  const nodes = new Map<string, Tree>(
    rows.map((row) => [row.id, { ...row, children: [] }]),
  )
  const roots: Tree[] = []
  for (const node of nodes.values()) {
    if (node.parent_id) nodes.get(node.parent_id)?.children.push(node)
    else roots.push(node)
  }
  // A corrupted/orphaned component must not disappear silently from the API.
  const reachable = new Set<string>(),
    pending = [...roots]
  for (let index = 0; index < pending.length; index++) {
    const node = pending[index]!
    if (reachable.has(node.id))
      throw new PracticeError(
        'invalid_topic_tree',
        500,
        'Cây chủ đề không hợp lệ',
      )
    reachable.add(node.id)
    pending.push(...node.children)
  }
  if (reachable.size !== nodes.size)
    throw new PracticeError(
      'invalid_topic_tree',
      500,
      'Cây chủ đề không hợp lệ',
    )
  return { items: roots, next_cursor: null }
}
async function owned(db: Db, id: string, userId: string, lock = false) {
  const result = await db.query<{
    id: string
    subject_id: string
    status: 'in_progress' | 'submitted' | 'expired'
    mode: 'practice' | 'mock' | 'review'
    deadline_at: Date | null
    blueprint_snapshot: unknown
    result: unknown
    request_hash: string
  }>(
    `SELECT * FROM attempts WHERE id=$1 AND user_id=$2 ${lock ? 'FOR UPDATE' : ''}`,
    [id, userId],
  )
  const attempt = result.rows[0]
  if (!attempt)
    throw new PracticeError('not_found', 404, 'Không tìm thấy bài làm')
  return attempt
}
async function readAttempt(db: Db, id: string, userId: string) {
  let attempt = await owned(db, id, userId)
  if (
    attempt.mode === 'mock' &&
    attempt.status === 'in_progress' &&
    (await passedDeadline(db, attempt.deadline_at))
  ) {
    await finalize(db, id, userId, randomUUID())
    attempt = await owned(db, id, userId)
  }
  const subject = await db.query<{ code: string }>(
    'SELECT code FROM subjects WHERE id=$1',
    [attempt.subject_id],
  )
  const result = await db.query<{
    position: number
    question_id: string
    revision_id: string
    stem: string
    answer: Label | null
    flagged: boolean
    choices: { label: Label; text: string }[]
    assets: { id: string; url: string; mime: string; alt_text: string }[]
  }>(
    `SELECT i.position,r.question_id,r.id AS revision_id,r.stem,i.answer,i.flagged,
      (SELECT json_agg(json_build_object('label',c.label,'text',c.text) ORDER BY c.label)
       FROM question_choices c WHERE c.revision_id=r.id) AS choices,
      COALESCE((SELECT json_agg(json_build_object('id',a.id,'url','/api/v1/assets/'||a.id::text,'mime',a.mime,'alt_text',a.alt_text) ORDER BY a.id)
      FROM assets a WHERE COALESCE(r.payload->'asset_ids','[]'::jsonb) ? a.id::text),'[]'::json) AS assets
     FROM attempt_items i JOIN question_revisions r ON r.id=i.question_revision_id
     WHERE i.attempt_id=$1 ORDER BY i.position`,
    [id],
  )
  return attemptSchema.parse({
    id,
    subject: subject.rows[0]?.code,
    mode: attempt.mode,
    status: attempt.status,
    ...(attempt.mode === 'mock'
      ? {
          deadline_at: attempt.deadline_at?.toISOString(),
          server_time: new Date().toISOString(),
        }
      : {}),
    items: result.rows,
  })
}
export function getAttempt(id: string, userId: string, db: Db = getPool()) {
  return transaction(
    (client) => readAttempt(client, id, userId),
    db === getPool() ? undefined : (db as pg.PoolClient),
  )
}

export async function createAttempt(
  input: CreateAttempt,
  key: string,
  userId: string,
  requestId: string = randomUUID(),
  context?: pg.PoolClient,
) {
  const normalized = {
    subject: input.subject,
    mode: input.mode,
    type: input.type,
    ...(input.mode === 'mock' ? { blueprint_id: input.blueprint_id } : {}),
    ...(input.mode === 'review' ? { source: input.source } : {}),
    difficulty: input.difficulty ?? null,
    count: input.count,
    topic_ids: [...new Set(input.topic_ids ?? [])].sort(),
  }
  const hash = createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex')
  return transaction(async (client) => {
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',
      [userId, key],
    )
    const previous = await client.query<{ id: string; request_hash: string }>(
      'SELECT id,request_hash FROM attempts WHERE user_id=$1 AND idempotency_key=$2',
      [userId, key],
    )
    if (previous.rows[0]) {
      if (previous.rows[0].request_hash !== hash)
        throw new PracticeError(
          'idempotency_key_mismatch',
          422,
          'Idempotency-Key đã dùng với nội dung khác',
        )
      return {
        attempt: await readAttempt(client, previous.rows[0].id, userId),
        replayed: true,
      }
    }
    const selected = await client.query<{ id: string }>(
      'SELECT id FROM subjects WHERE code=$1',
      [input.subject],
    )
    const subject = selected.rows[0]
    if (!subject)
      throw new PracticeError('not_found', 404, 'Không tìm thấy môn học')
    if (normalized.topic_ids.length) {
      const valid = await client.query(
        'SELECT id FROM topics WHERE subject_id=$1 AND id=ANY($2::uuid[])',
        [subject.id, normalized.topic_ids],
      )
      if (valid.rowCount !== normalized.topic_ids.length)
        throw new PracticeError(
          'validation_failed',
          400,
          'Chủ đề không thuộc môn học',
        )
    }
    let available: { rows: { current_revision_id: string }[] } =
      input.mode === 'practice'
        ? await client.query<{ current_revision_id: string }>(
            `WITH RECURSIVE selected_topics AS (
   SELECT id FROM topics WHERE subject_id=$1 AND id=ANY($2::uuid[])
   UNION SELECT t.id FROM topics t JOIN selected_topics st ON t.parent_id=st.id WHERE t.subject_id=$1
  ) SELECT q.current_revision_id FROM questions q WHERE q.subject_id=$1 AND q.status='approved' AND q.type='mcq'
    AND ($3::int IS NULL OR q.difficulty=$3)
    AND (cardinality($2::uuid[])=0 OR EXISTS(SELECT 1 FROM question_topics qt WHERE qt.question_id=q.id AND qt.topic_id IN (SELECT id FROM selected_topics)))
    ORDER BY random() LIMIT $4`,
            [
              subject.id,
              normalized.topic_ids,
              input.difficulty ?? null,
              input.count,
            ],
          )
        : { rows: [] }
    let blueprint: { id: string; spec: unknown } | undefined
    let duration: number | null = null
    let snapshot: unknown = null
    let seed: string | null = null
    let required = input.count
    if (input.mode === 'mock') {
      const bp = await client.query<{
        id: string
        spec: unknown
        version: number
      }>(
        "SELECT id,spec,version FROM exam_blueprints WHERE id=$1 AND subject_id=$2 AND status='active' FOR SHARE",
        [input.blueprint_id, subject.id],
      )
      blueprint = bp.rows[0]
      if (!blueprint)
        throw new PracticeError(
          'not_found',
          404,
          'Không tìm thấy cấu hình thi đang áp dụng',
        )
      const spec = blueprintSpecSchema.parse(blueprint.spec)
      duration = spec.duration_seconds
      snapshot = { ...spec, version: bp.rows[0]!.version }
      seed = randomUUID()
      const candidates = await client.query<Candidate>(
        `WITH RECURSIVE ancestry AS (
        SELECT id,id AS ancestor_id,parent_id FROM topics WHERE subject_id=$1
        UNION ALL SELECT a.id,t.id,t.parent_id FROM ancestry a JOIN topics t ON t.id=a.parent_id
      ) SELECT q.id,q.current_revision_id AS revision_id,q.difficulty,
        COALESCE(array_agg(DISTINCT a.ancestor_id) FILTER(WHERE a.ancestor_id IS NOT NULL),'{}'::uuid[]) topic_ids
        FROM questions q LEFT JOIN question_topics qt ON qt.question_id=q.id LEFT JOIN ancestry a ON a.id=qt.topic_id
        WHERE q.subject_id=$1 AND q.status='approved' AND q.type='mcq' GROUP BY q.id`,
        [subject.id],
      )
      try {
        const selected = assembleExam(candidates.rows, spec.slots, seed)
        available = {
          ...available,
          rows: selected.map((c) => ({ current_revision_id: c.revision_id })),
        }
      } catch (error) {
        if (error instanceof InsufficientQuestions)
          throw new PracticeError(
            'insufficient_questions',
            422,
            'Chưa đủ câu hỏi cho cấu hình thi; không tạo bài thiếu câu',
          )
        throw error
      }
      required = spec.slots.reduce((sum, slot) => sum + slot.count, 0)
    } else if (input.mode === 'review') {
      available = await client.query<{ current_revision_id: string }>(
        `WITH latest AS (
        SELECT DISTINCT ON (r.question_id) r.question_id,i.is_correct,i.flagged,i.answer
        FROM attempt_items i JOIN attempts a ON a.id=i.attempt_id JOIN question_revisions r ON r.id=i.question_revision_id
        WHERE a.user_id=$1 AND a.subject_id=$2 AND a.status IN ('submitted','expired')
        ORDER BY r.question_id,a.submitted_at DESC,a.id DESC,i.position DESC
      ) SELECT q.current_revision_id FROM latest l JOIN questions q ON q.id=l.question_id
      WHERE q.status='approved' AND q.type='mcq' AND
        (($3='wrong' AND (l.is_correct IS NOT TRUE OR l.answer IS NULL)) OR ($3='flagged' AND l.flagged))
      ORDER BY q.id LIMIT $4`,
        [userId, subject.id, input.source, input.count],
      )
    }
    if (available.rows.length < required)
      throw new PracticeError(
        'insufficient_questions',
        422,
        'Chưa đủ câu hỏi cho bộ lọc đã chọn',
      )
    const locked = await client.query(
      `SELECT current_revision_id FROM questions WHERE current_revision_id=ANY($1::uuid[]) AND status='approved' FOR SHARE`,
      [available.rows.map((q) => q.current_revision_id)],
    )
    if (locked.rowCount !== required)
      throw new PracticeError(
        'insufficient_questions',
        422,
        'Ngân hàng câu hỏi vừa thay đổi; vui lòng thử lại',
      )
    const saved = await client.query<{ id: string }>(
      `INSERT INTO attempts(user_id,subject_id,mode,idempotency_key,request_hash,blueprint_id,blueprint_snapshot,random_seed,deadline_at)
       VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,CASE WHEN $9::int IS NULL THEN NULL ELSE clock_timestamp()+$9*interval '1 second' END) RETURNING id`,
      [
        userId,
        subject.id,
        input.mode,
        key,
        hash,
        blueprint?.id ?? null,
        snapshot ? JSON.stringify(snapshot) : null,
        seed,
        duration,
      ],
    )
    const id = saved.rows[0]!.id
    await client.query(
      'INSERT INTO attempt_items(attempt_id,position,question_revision_id) SELECT $1,n::int,revision FROM unnest($2::uuid[]) WITH ORDINALITY AS entries(revision,n)',
      [id, available.rows.map((q) => q.current_revision_id)],
    )
    await appendAudit(client, {
      actorId: userId,
      action: 'attempt.created',
      entityType: 'attempt',
      entityId: id,
      requestId,
    })
    return { attempt: await readAttempt(client, id, userId), replayed: false }
  }, context)
}

async function passedDeadline(db: Db, deadline: Date | null) {
  if (!deadline) return false
  const result = await db.query<{ expired: boolean }>(
    'SELECT clock_timestamp()>=$1::timestamptz AS expired',
    [deadline],
  )
  return result.rows[0]!.expired
}
async function finalize(db: Db, id: string, userId: string, requestId: string) {
  const attempt = await owned(db, id, userId, true)
  if (attempt.status !== 'in_progress')
    return resultSchema.parse(attempt.result)
  const outcome =
    attempt.mode === 'mock' && (await passedDeadline(db, attempt.deadline_at))
      ? 'expired'
      : 'submitted'
  const counts = await db.query<{
    total: number
    correct: number
    unanswered: number
  }>(
    'SELECT count(*)::int total,count(*) FILTER(WHERE is_correct)::int correct,count(*) FILTER(WHERE answer IS NULL)::int unanswered FROM attempt_items WHERE attempt_id=$1',
    [id],
  )
  const count = counts.rows[0]!
  const topicCounts = await db.query(
    `SELECT t.topic_id,(array_agg(t.title ORDER BY i.position))[1] title,
    count(*)::int total,count(*) FILTER(WHERE i.is_correct)::int correct
    FROM attempt_items i CROSS JOIN LATERAL jsonb_to_recordset(i.topic_snapshot) AS t(topic_id uuid,title text,sort_order integer,code text)
    WHERE i.attempt_id=$1 GROUP BY t.topic_id ORDER BY min(t.sort_order),min(t.code),t.topic_id`,
    [id],
  )
  let feedback: unknown[] | undefined
  if (attempt.mode === 'mock') {
    const rows = await db.query(
      `SELECT i.position,i.is_correct,r.explanation,r.payload,
      (SELECT label FROM question_choices WHERE revision_id=r.id AND is_correct) correct_answer
      FROM attempt_items i JOIN question_revisions r ON r.id=i.question_revision_id WHERE i.attempt_id=$1 ORDER BY i.position`,
      [id],
    )
    feedback = rows.rows.map((row) => ({
      position: row.position,
      feedback: feedbackSchema.parse({
        is_correct: row.is_correct === true,
        correct_answer: row.correct_answer,
        explanation: row.explanation,
        sources: row.payload.sources,
      }),
    }))
  }
  const summary = resultSchema.parse({
    attempt_id: id,
    ...count,
    score: count.total
      ? Math.round((count.correct / count.total) * 100) / 10
      : 0,
    by_topic: topicCounts.rows,
    ...(attempt.mode === 'mock' ? { outcome, feedback } : {}),
  })
  await db.query(
    'UPDATE attempts SET status=$2,submitted_at=clock_timestamp(),result=$3::jsonb WHERE id=$1',
    [id, outcome, JSON.stringify(summary)],
  )
  await appendAudit(db, {
    actorId: userId,
    action: 'attempt.submitted',
    entityType: 'attempt',
    entityId: id,
    details: { status: outcome },
    requestId,
  })
  return summary
}
export function answerItem(
  id: string,
  position: number,
  answer: Label | undefined,
  flagged: boolean | undefined,
  userId: string,
  requestId: string = randomUUID(),
) {
  return transaction(async (client) => {
    const attempt = await owned(client, id, userId, true)
    const result = await client.query<{
      id: string
      question_revision_id: string
      answer: Label | null
      flagged: boolean
    }>('SELECT * FROM attempt_items WHERE attempt_id=$1 AND position=$2', [
      id,
      position,
    ])
    const item = result.rows[0]
    if (!item)
      throw new PracticeError('not_found', 404, 'Không tìm thấy câu hỏi')
    if (
      attempt.mode === 'mock' &&
      attempt.status === 'in_progress' &&
      (await passedDeadline(client, attempt.deadline_at))
    )
      return {
        saved: false,
        status: 'expired',
        result: await finalize(client, id, userId, requestId),
      }
    if (attempt.status !== 'in_progress') {
      if (
        attempt.mode === 'mock' ||
        (answer !== undefined && item.answer !== answer) ||
        (flagged !== undefined && flagged !== item.flagged)
      )
        throw new PracticeError(
          'invalid_state_transition',
          422,
          'Bài làm đã kết thúc',
        )
    }
    if (
      attempt.mode !== 'mock' &&
      answer !== undefined &&
      item.answer !== null &&
      item.answer !== answer
    )
      throw new PracticeError('invalid_state_transition', 422, 'Đáp án đã lưu')
    if (answer === undefined) {
      if (attempt.status !== 'in_progress')
        throw new PracticeError(
          'invalid_state_transition',
          422,
          'Bài làm đã kết thúc',
        )
      await client.query(
        'UPDATE attempt_items SET flagged=COALESCE($2,flagged) WHERE id=$1',
        [item.id, flagged ?? null],
      )
      return { saved: true }
    }
    const choices = await client.query<Choice>(
      'SELECT label,text,is_correct FROM question_choices WHERE revision_id=$1 ORDER BY label',
      [item.question_revision_id],
    )
    const grade = gradeMcq(choices.rows, answer)
    if (
      attempt.status === 'in_progress' &&
      (item.answer !== answer ||
        (flagged !== undefined && flagged !== item.flagged))
    ) {
      const updated = await client.query(
        `UPDATE attempt_items SET answer=$2::jsonb,is_correct=$3,answered_at=clock_timestamp(),flagged=COALESCE($4,flagged)
        WHERE id=$1 AND ($5::timestamptz IS NULL OR clock_timestamp()<$5::timestamptz) RETURNING id`,
        [
          item.id,
          JSON.stringify(answer),
          grade.is_correct,
          flagged ?? null,
          attempt.mode === 'mock' ? attempt.deadline_at : null,
        ],
      )
      if (!updated.rowCount)
        return {
          saved: false,
          status: 'expired',
          result: await finalize(client, id, userId, requestId),
        }
      await appendAudit(client, {
        actorId: userId,
        action: 'attempt.answered',
        entityType: 'attempt',
        entityId: id,
        details: { position },
        requestId,
      })
    }
    if (attempt.mode === 'mock') return { saved: true }
    const revision = await client.query<{
      explanation: string
      payload: { sources: unknown }
    }>('SELECT explanation,payload FROM question_revisions WHERE id=$1', [
      item.question_revision_id,
    ])
    return feedbackSchema.parse({
      ...grade,
      explanation: revision.rows[0]!.explanation,
      sources: revision.rows[0]!.payload.sources,
    })
  })
}
export function submitAttempt(
  id: string,
  userId: string,
  requestId: string = randomUUID(),
  context?: pg.PoolClient,
) {
  return transaction(
    (client) => finalize(client, id, userId, requestId),
    context,
  )
}
