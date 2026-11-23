import { createHash, randomUUID } from 'node:crypto'
import type pg from 'pg'
import {
  writtenPaperInputSchema,
  type WrittenPaperInput,
  type WrittenAttempt,
  type WrittenSection,
} from '@pharmacy/api-contract'
import { getPool } from './client'
import { PracticeError } from './practice'
import { appendAudit } from './audit'
type Db = Pick<pg.PoolClient, 'query'>
async function tx<T>(run: (db: pg.PoolClient) => Promise<T>) {
  const db = await getPool().connect()
  try {
    await db.query('BEGIN')
    const value = await run(db)
    await db.query('COMMIT')
    return value
  } catch (e) {
    await db.query('ROLLBACK')
    throw e
  } finally {
    db.release()
  }
}
function pdf(value: string) {
  const bytes = Buffer.from(value, 'base64')
  if (
    bytes.length > 5 * 1024 * 1024 ||
    !bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))
  )
    throw new PracticeError(
      'validation_failed',
      400,
      'Cần PDF hợp lệ tối đa5MiB',
    )
  return bytes
}
export async function saveWrittenPaper(
  raw: WrittenPaperInput,
  userId: string,
  requestId: string = randomUUID(),
) {
  const input = writtenPaperInputSchema.parse(raw),
    exam = pdf(input.exam_pdf_base64),
    reference = input.reference_pdf_base64
      ? pdf(input.reference_pdf_base64)
      : null
  const hash = createHash('sha256')
    .update(
      JSON.stringify([
        input.name,
        input.subject,
        input.duration_seconds,
        input.sections,
      ]),
    )
    .update(exam)
    .update(reference ?? Buffer.alloc(0))
    .digest('hex')
  return tx(async (db) => {
    const r = await db.query(
      `INSERT INTO written_papers(user_id,subject_code,name,duration_seconds,sections,exam_pdf,reference_pdf,content_hash)
 VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8) ON CONFLICT(user_id,content_hash) DO NOTHING RETURNING id`,
      [
        userId,
        input.subject,
        input.name,
        input.duration_seconds,
        JSON.stringify(input.sections),
        exam,
        reference,
        hash,
      ],
    )
    if (!r.rowCount) {
      const prior = await db.query(
        'SELECT id FROM written_papers WHERE user_id=$1 AND content_hash=$2',
        [userId, hash],
      )
      r.rows = prior.rows
    }
    await appendAudit(db, {
      actorId: userId,
      action: 'written.paper_saved',
      entityType: 'written_paper',
      entityId: r.rows[0].id,
      requestId,
    })
    return { id: r.rows[0].id }
  })
}
export async function writtenPapers(
  userId: string,
  cursor?: string,
  limit = 20,
) {
  const r = await getPool().query(
    'SELECT id,name,subject_code AS subject,duration_seconds,sections FROM written_papers WHERE user_id=$1 AND ($2::uuid IS NULL OR id>$2) ORDER BY id LIMIT $3',
    [userId, cursor ?? null, limit + 1],
  )
  const items = r.rows.slice(0, limit)
  return { items, next_cursor: r.rows.length > limit ? items.at(-1)!.id : null }
}
async function owned(db: Db, id: string, userId: string) {
  const r = await db.query(
    'SELECT *,clock_timestamp()>=deadline_at expired FROM written_attempts WHERE id=$1 AND user_id=$2 FOR UPDATE',
    [id, userId],
  )
  if (!r.rowCount)
    throw new PracticeError('not_found', 404, 'Không tìm thấy bài tự luận')
  return r.rows[0]
}
async function finish(
  db: Db,
  row: { id: string; status: string; expired: boolean },
  userId: string,
  requestId: string,
) {
  if (row.status === 'in_progress') {
    await db.query(
      'UPDATE written_attempts SET status=$2,submitted_at=clock_timestamp() WHERE id=$1',
      [row.id, row.expired ? 'expired' : 'submitted'],
    )
    await appendAudit(db, {
      actorId: userId,
      action: 'written.submitted',
      entityType: 'written_attempt',
      entityId: row.id,
      details: { status: row.expired ? 'expired' : 'submitted' },
      requestId,
    })
  }
}
async function view(
  db: Db,
  id: string,
  userId: string,
): Promise<WrittenAttempt> {
  const row = await owned(db, id, userId)
  const answers = await db.query(
    'SELECT position,text,points::float8 points FROM written_answers WHERE attempt_id=$1 ORDER BY position',
    [id],
  )
  const p = row.paper_snapshot
  return {
    id,
    paper_id: row.paper_id,
    name: p.name,
    status: row.status,
    deadline_at: row.deadline_at.toISOString(),
    server_time: new Date().toISOString(),
    sections: p.sections,
    answers: answers.rows,
    score: row.score === null ? null : Number(row.score),
    grading_status: row.grading_status,
    reference_available:
      Boolean(p.reference_available) && row.status !== 'in_progress',
  }
}
export function startWritten(
  paperId: string,
  userId: string,
  key: string,
  requestId: string = randomUUID(),
) {
  if (!key || key.length > 128)
    throw new PracticeError(
      'validation_failed',
      400,
      'Cần Idempotency-Key tối đa128ký tự',
    )
  return tx(async (db) => {
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [
      userId,
      key,
    ])
    const hash = createHash('sha256').update(paperId).digest('hex')
    const prior = await db.query(
      'SELECT id,request_hash FROM written_attempts WHERE user_id=$1 AND idempotency_key=$2',
      [userId, key],
    )
    if (prior.rowCount) {
      if (prior.rows[0].request_hash !== hash)
        throw new PracticeError(
          'idempotency_key_mismatch',
          422,
          'Key đã dùng với đề khác',
        )
      return {
        attempt: await view(db, prior.rows[0].id, userId),
        replayed: true,
      }
    }
    const p = (
      await db.query(
        'SELECT id,name,duration_seconds,sections,reference_pdf IS NOT NULL reference_available FROM written_papers WHERE id=$1 AND user_id=$2',
        [paperId, userId],
      )
    ).rows[0]
    if (!p)
      throw new PracticeError(
        'not_found',
        404,
        'Không tìm thấy đề tự luận riêng',
      )
    const result = await db.query(
      `INSERT INTO written_attempts(user_id,paper_id,paper_snapshot,deadline_at,idempotency_key,request_hash) VALUES($1,$2,$3::jsonb,clock_timestamp()+$4*interval '1 second',$5,$6) RETURNING id`,
      [userId, paperId, JSON.stringify(p), p.duration_seconds, key, hash],
    )
    const id = result.rows[0].id
    await db.query(
      'INSERT INTO written_answers(attempt_id,position) SELECT $1,n FROM generate_series(1,$2::int) n',
      [id, p.sections.length],
    )
    await appendAudit(db, {
      actorId: userId,
      action: 'written.created',
      entityType: 'written_attempt',
      entityId: id,
      requestId,
    })
    return { attempt: await view(db, id, userId), replayed: false }
  })
}
export function getWritten(
  id: string,
  userId: string,
  requestId: string = randomUUID(),
) {
  return tx(async (db) => {
    const row = await owned(db, id, userId)
    if (row.expired) await finish(db, row, userId, requestId)
    return view(db, id, userId)
  })
}
export function saveWrittenAnswer(
  id: string,
  userId: string,
  position: number,
  text: string,
  requestId: string = randomUUID(),
) {
  return tx(async (db) => {
    const row = await owned(db, id, userId)
    if (row.status !== 'in_progress')
      throw new PracticeError(
        'invalid_state_transition',
        422,
        'Bài tự luận đã kết thúc',
      )
    if (row.expired) {
      await finish(db, row, userId, requestId)
      return view(db, id, userId)
    }
    const saved = await db.query(
      `UPDATE written_answers SET text=$3 WHERE attempt_id=$1 AND position=$2 AND EXISTS(SELECT 1 FROM written_attempts WHERE id=$1 AND clock_timestamp()<deadline_at) RETURNING position`,
      [id, position, text],
    )
    if (!saved.rowCount) {
      if (!(row.paper_snapshot.sections as WrittenSection[])[position - 1])
        throw new PracticeError('not_found', 404, 'Không tìm thấy câu')
      const fresh = await owned(db, id, userId)
      await finish(db, fresh, userId, requestId)
    }
    return view(db, id, userId)
  })
}
export function submitWritten(
  id: string,
  userId: string,
  requestId: string = randomUUID(),
) {
  return tx(async (db) => {
    await finish(db, await owned(db, id, userId), userId, requestId)
    return view(db, id, userId)
  })
}
export function gradeWritten(
  id: string,
  userId: string,
  points: number[],
  requestId: string = randomUUID(),
) {
  return tx(async (db) => {
    const row = await owned(db, id, userId)
    if (row.status === 'in_progress')
      throw new PracticeError(
        'invalid_state_transition',
        422,
        'Nộp bài trước khi tự chấm',
      )
    const sections = row.paper_snapshot.sections as WrittenSection[]
    if (
      points.length !== sections.length ||
      points.some(
        (p, i) => !Number.isFinite(p) || p < 0 || p > sections[i]!.max_points,
      )
    )
      throw new PracticeError(
        'validation_failed',
        400,
        'Điểm từng câu phải nằm trong thang điểm của đề',
      )
    for (const [index, value] of points.entries())
      await db.query(
        'UPDATE written_answers SET points=$3 WHERE attempt_id=$1 AND position=$2',
        [id, index + 1, value],
      )
    await db.query(
      "UPDATE written_attempts SET grading_status='self_assessed',score=$2 WHERE id=$1",
      [id, Math.round(points.reduce((a, b) => a + b, 0) * 100) / 100],
    )
    await appendAudit(db, {
      actorId: userId,
      action: 'written.self_assessed',
      entityType: 'written_attempt',
      entityId: id,
      requestId,
    })
    return view(db, id, userId)
  })
}
export async function writtenPdf(
  paperId: string,
  userId: string,
  attemptId?: string,
) {
  const r = await getPool().query(
    'SELECT exam_pdf,reference_pdf FROM written_papers WHERE id=$1 AND user_id=$2',
    [paperId, userId],
  )
  if (!r.rowCount)
    throw new PracticeError('not_found', 404, 'Không tìm thấy tài liệu riêng')
  if (attemptId) {
    const attempt = await getWritten(attemptId, userId)
    if (attempt.paper_id !== paperId || attempt.status === 'in_progress')
      throw new PracticeError(
        'forbidden',
        403,
        'Nộp bài trước khi mở tài liệu đối chiếu',
      )
    if (!r.rows[0].reference_pdf)
      throw new PracticeError('not_found', 404, 'Không có tài liệu đối chiếu')
    return r.rows[0].reference_pdf as Buffer
  }
  return r.rows[0].exam_pdf as Buffer
}

export async function writtenHistory(
  userId: string,
  cursor?: string,
  limit = 20,
) {
  const result = await getPool().query(
    `SELECT id,paper_snapshot->>'name' name,paper_id,started_at,
   CASE WHEN status='in_progress' AND clock_timestamp()>=deadline_at THEN 'expired' ELSE status END status,
   grading_status,score::float8 score FROM written_attempts
   WHERE user_id=$1 AND ($2::uuid IS NULL OR (started_at,id)<(SELECT started_at,id FROM written_attempts WHERE id=$2 AND user_id=$1))
   ORDER BY started_at DESC,id DESC LIMIT $3`,
    [userId, cursor ?? null, limit + 1],
  )
  const items = result.rows.slice(0, limit)
  return {
    items,
    next_cursor: result.rows.length > limit ? items.at(-1)!.id : null,
  }
}
