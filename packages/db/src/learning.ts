import { createHash } from 'node:crypto'
import {
  blueprintInputSchema,
  type BlueprintInput,
} from '@pharmacy/api-contract'
import { getPool } from './client'
import { appendAudit } from './audit'
import { PracticeError } from './practice'

export async function listBlueprints(
  subject?: string,
  admin = false,
  cursor?: string,
  limit = 20,
) {
  const result = await getPool().query(
    `SELECT b.id,s.code subject,b.name,b.status,b.version,b.spec
    FROM exam_blueprints b JOIN subjects s ON s.id=b.subject_id
    WHERE ($1::text IS NULL OR s.code=$1) AND ($2 OR b.status='active') AND ($3::uuid IS NULL OR b.id>$3)
    ORDER BY b.id LIMIT $4`,
    [subject ?? null, admin, cursor ?? null, limit + 1],
  )
  const items = result.rows.slice(0, limit)
  return {
    items,
    next_cursor: result.rows.length > limit ? items.at(-1)!.id : null,
  }
}
export async function saveBlueprint(
  input: BlueprintInput,
  actorId: string,
  requestId: string,
  id?: string,
  key?: string,
) {
  const value = blueprintInputSchema.parse(input)
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const actor = await client.query(
      "SELECT id FROM users WHERE id=$1 AND role='admin' AND status='active' FOR SHARE",
      [actorId],
    )
    if (!actor.rowCount)
      throw new PracticeError('forbidden', 403, 'Cần quyền quản trị')
    const subject = await client.query(
      'SELECT id FROM subjects WHERE code=$1',
      [value.subject],
    )
    if (!subject.rowCount)
      throw new PracticeError('not_found', 404, 'Không tìm thấy môn học')
    const topics = [
      ...new Set(
        value.spec.slots.flatMap((slot) =>
          slot.topic_id ? [slot.topic_id] : [],
        ),
      ),
    ]
    const valid = await client.query(
      'SELECT id FROM topics WHERE subject_id=$1 AND id=ANY($2::uuid[])',
      [subject.rows[0].id, topics],
    )
    if (valid.rowCount !== topics.length)
      throw new PracticeError(
        'validation_failed',
        400,
        'Chủ đề phải thuộc môn học',
      )
    let saved
    let replayed = false
    if (id) {
      if (!value.expected_version)
        throw new PracticeError(
          'validation_failed',
          400,
          'Cần phiên bản đang sửa',
        )
      saved = await client.query(
        `UPDATE exam_blueprints SET name=$2,status=$3,spec=$4::jsonb,version=version+1,updated_at=clock_timestamp()
        WHERE id=$1 AND version=$5 AND subject_id=$6 RETURNING id,name,status,spec,version`,
        [
          id,
          value.name,
          value.status,
          JSON.stringify(value.spec),
          value.expected_version,
          subject.rows[0].id,
        ],
      )
      if (!saved.rowCount)
        throw new PracticeError(
          'version_conflict',
          409,
          'Cấu hình đã thay đổi hoặc không thuộc môn học; hãy tải lại',
        )
    } else {
      if (!key || key.length > 128)
        throw new PracticeError(
          'validation_failed',
          400,
          'Cần Idempotency-Key tối đa128ký tự',
        )
      const hash = createHash('sha256')
        .update(JSON.stringify(value))
        .digest('hex')
      await client.query(
        'SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))',
        [actorId, key],
      )
      const prior = await client.query(
        'SELECT id,name,status,spec,version,request_hash FROM exam_blueprints WHERE created_by=$1 AND idempotency_key=$2',
        [actorId, key],
      )
      if (prior.rowCount) {
        if (prior.rows[0].request_hash !== hash)
          throw new PracticeError(
            'idempotency_key_mismatch',
            422,
            'Key đã dùng với nội dung khác',
          )
        saved = prior
        replayed = true
      } else
        saved = await client.query(
          `INSERT INTO exam_blueprints(subject_id,name,status,spec,created_by,idempotency_key,request_hash)
        VALUES($1,$2,$3,$4::jsonb,$5,$6,$7) RETURNING id,name,status,spec,version`,
          [
            subject.rows[0].id,
            value.name,
            value.status,
            JSON.stringify(value.spec),
            actorId,
            key,
            hash,
          ],
        )
    }
    if (!replayed)
      await appendAudit(client, {
        actorId,
        action: 'blueprint.saved',
        entityType: 'exam_blueprint',
        entityId: saved.rows[0].id,
        details: { status: value.status },
        requestId,
      })
    await client.query('COMMIT')
    const item = { ...saved.rows[0] }
    delete item.request_hash
    return { item: { ...item, subject: value.subject }, replayed }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
