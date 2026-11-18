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
  const attempt = await owned(db, id, userId)
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
  }>(
    `SELECT i.position,r.question_id,r.id AS revision_id,r.stem,i.answer,i.flagged,
      (SELECT json_agg(json_build_object('label',c.label,'text',c.text) ORDER BY c.label)
       FROM question_choices c WHERE c.revision_id=r.id) AS choices
     FROM attempt_items i JOIN question_revisions r ON r.id=i.question_revision_id
     WHERE i.attempt_id=$1 ORDER BY i.position`,
    [id],
  )
  return attemptSchema.parse({
    id,
    subject: subject.rows[0]?.code,
    mode: 'practice',
    status: attempt.status,
    items: result.rows,
  })
}
export function getAttempt(id: string, userId: string, db: Db = getPool()) {
  return readAttempt(db, id, userId)
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
    const available = await client.query<{ current_revision_id: string }>(
      `WITH RECURSIVE selected_topics AS (
   SELECT id FROM topics WHERE subject_id=$1 AND id=ANY($2::uuid[])
   UNION SELECT t.id FROM topics t JOIN selected_topics st ON t.parent_id=st.id WHERE t.subject_id=$1
  ) SELECT q.current_revision_id FROM questions q WHERE q.subject_id=$1 AND q.status='approved' AND q.type='mcq'
    AND ($3::int IS NULL OR q.difficulty=$3)
    AND (cardinality($2::uuid[])=0 OR EXISTS(SELECT 1 FROM question_topics qt WHERE qt.question_id=q.id AND qt.topic_id IN (SELECT id FROM selected_topics)))
    ORDER BY random() LIMIT $4`,
      [subject.id, normalized.topic_ids, input.difficulty ?? null, input.count],
    )
    if (available.rows.length < input.count)
      throw new PracticeError(
        'insufficient_questions',
        422,
        'Chưa đủ câu hỏi cho bộ lọc đã chọn',
      )
    const saved = await client.query<{ id: string }>(
      'INSERT INTO attempts(user_id,subject_id,mode,idempotency_key,request_hash) VALUES($1,$2,$3,$4,$5) RETURNING id',
      [userId, subject.id, input.mode, key, hash],
    )
    const id = saved.rows[0]!.id
    for (const [index, question] of available.rows.entries())
      await client.query(
        'INSERT INTO attempt_items(attempt_id,position,question_revision_id) VALUES($1,$2,$3)',
        [id, index + 1, question.current_revision_id],
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

export function answerItem(
  id: string,
  position: number,
  answer: Label,
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
      (item.answer !== null && item.answer !== answer) ||
      (attempt.status !== 'in_progress' &&
        (item.answer !== answer ||
          (flagged !== undefined && flagged !== item.flagged)))
    )
      throw new PracticeError(
        'invalid_state_transition',
        422,
        'Đáp án đã lưu hoặc bài đã kết thúc',
      )
    const choices = await client.query<Choice>(
      'SELECT label,text,is_correct FROM question_choices WHERE revision_id=$1 ORDER BY label',
      [item.question_revision_id],
    )
    const grade = gradeMcq(choices.rows, answer)
    const revision = await client.query<{
      explanation: string
      payload: { sources: unknown }
    }>('SELECT explanation,payload FROM question_revisions WHERE id=$1', [
      item.question_revision_id,
    ])
    const feedback = feedbackSchema.parse({
      ...grade,
      explanation: revision.rows[0]!.explanation,
      sources: revision.rows[0]!.payload.sources,
    })
    if (
      attempt.status === 'in_progress' &&
      (item.answer === null ||
        (flagged !== undefined && flagged !== item.flagged))
    ) {
      await client.query(
        'UPDATE attempt_items SET answer=$2::jsonb,is_correct=$3,answered_at=COALESCE(answered_at,now()),flagged=COALESCE($4,flagged) WHERE id=$1',
        [item.id, JSON.stringify(answer), grade.is_correct, flagged ?? null],
      )
      await appendAudit(client, {
        actorId: userId,
        action: item.answer === null ? 'attempt.answered' : 'attempt.flagged',
        entityType: 'attempt',
        entityId: id,
        details: { position, is_correct: grade.is_correct },
        requestId,
      })
    }
    return feedback
  })
}
export function submitAttempt(
  id: string,
  userId: string,
  requestId: string = randomUUID(),
  context?: pg.PoolClient,
) {
  return transaction(async (client) => {
    const attempt = await owned(client, id, userId, true)
    if (attempt.status === 'submitted')
      return resultSchema.parse(attempt.result)
    if (attempt.status !== 'in_progress')
      throw new PracticeError(
        'invalid_state_transition',
        422,
        'Bài làm đã kết thúc',
      )
    const counts = await client.query<{
      total: number
      correct: number
      unanswered: number
    }>(
      'SELECT count(*)::int total,count(*) FILTER(WHERE is_correct)::int correct,count(*) FILTER(WHERE answer IS NULL)::int unanswered FROM attempt_items WHERE attempt_id=$1',
      [id],
    )
    const count = counts.rows[0]!
    const topicCounts = await client.query(
      `SELECT t.topic_id,(array_agg(t.title ORDER BY i.position))[1] title,
       count(*)::int total,count(*) FILTER(WHERE i.is_correct)::int correct
       FROM attempt_items i CROSS JOIN LATERAL jsonb_to_recordset(i.topic_snapshot)
         AS t(topic_id uuid,title text,sort_order integer,code text)
       WHERE i.attempt_id=$1 GROUP BY t.topic_id
       ORDER BY min(t.sort_order),min(t.code),t.topic_id`,
      [id],
    )
    const score = count.total
      ? Math.round((count.correct / count.total) * 100) / 10
      : 0
    const summary = resultSchema.parse({
      attempt_id: id,
      ...count,
      score,
      by_topic: topicCounts.rows,
    })
    await client.query(
      "UPDATE attempts SET status='submitted',submitted_at=now(),result=$2::jsonb WHERE id=$1",
      [id, JSON.stringify(summary)],
    )
    await appendAudit(client, {
      actorId: userId,
      action: 'attempt.submitted',
      entityType: 'attempt',
      entityId: id,
      details: { status: 'submitted' },
      requestId,
    })
    return summary
  }, context)
}
