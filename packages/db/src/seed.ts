import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from './maintenance'
import { readFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { validateChoices, type Label } from '@pharmacy/core'
import { DEV_USER_ID } from './client'

type Fixture = {
  stem: string
  choices: string[]
  correct: Label
  explanation: string
  topic: number
}
const fixtures: Fixture[] = JSON.parse(
  await readFile(
    new URL('../../../content/fixtures/practice.json', import.meta.url),
    'utf8',
  ),
)
const id = (group: number, n: number) =>
  `${group}0000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const sourceId = id(5, 1)
const sourceTitle = 'Fixture tổng hợp do tác giả dự án tự viết'
const sourceFile = 'content/fixtures/practice.json'
loadMaintenanceEnv()
const client = await getMaintenancePool().connect()
try {
  await client.query('BEGIN')
  await client.query(
    "INSERT INTO users(id,email,display_name,role) VALUES($1,'dev@example.invalid','Người học mẫu','learner') ON CONFLICT(id) DO NOTHING",
    [DEV_USER_ID],
  )
  await client.query(
    "INSERT INTO subjects(id,code,name) VALUES($1,'synthetic','Môn mẫu tổng hợp') ON CONFLICT(id) DO NOTHING",
    [id(1, 1)],
  )
  await client.query(
    `INSERT INTO sources(id,subject_id,kind,title,locator,license,review_status,retrieved_at,fingerprint,audience)
     VALUES($1,$2,'manual',$3,$4,'project-authored','approved',now(),$5,'public')
     ON CONFLICT(id) DO NOTHING`,
    [
      sourceId,
      id(1, 1),
      sourceTitle,
      sourceFile,
      'synthetic:practice-fixtures',
    ],
  )
  for (const [n, title] of [
    'Cây chủ đề mẫu',
    'Đọc dữ liệu',
    'Tính toán cơ bản',
  ].entries()) {
    await client.query(
      'INSERT INTO topics(id,subject_id,parent_id,code,title,sort_order) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO NOTHING',
      [
        id(2, n + 1),
        id(1, 1),
        n === 0 ? null : id(2, 1),
        `sample-${n}`,
        title,
        n,
      ],
    )
  }
  for (const [index, fixture] of fixtures.entries()) {
    const qid = id(3, index + 1)
    const originalRevisionId = id(4, index + 1)
    const locator = `${sourceFile}, câu ${index + 1}`
    const choices = fixture.choices.map((text, i) => ({
      label: 'ABCD'[i] as Label,
      text,
      is_correct: 'ABCD'[i] === fixture.correct,
    }))
    validateChoices(choices)
    const hash = createHash('sha256')
      .update(JSON.stringify(fixture))
      .digest('hex')
    await client.query(
      "INSERT INTO questions(id,subject_id,type,difficulty,status) VALUES($1,$2,'mcq',1,'draft') ON CONFLICT(id) DO NOTHING",
      [qid, id(1, 1)],
    )
    const {
      rows: [existing],
    } = await client.query<{
      status: string
      current_revision_id: string | null
      original_hash: string | null
      has_provenance: boolean
    }>(
      `SELECT q.status,q.current_revision_id,r.content_hash AS original_hash,
              EXISTS(SELECT 1 FROM question_sources WHERE revision_id=r.id) AS has_provenance
       FROM questions q LEFT JOIN question_revisions r ON r.id=$2 AND r.question_id=q.id
       WHERE q.id=$1 AND q.subject_id=$3 FOR UPDATE OF q`,
      [qid, originalRevisionId, id(1, 1)],
    )
    if (
      !existing ||
      (existing.original_hash !== null && existing.original_hash !== hash)
    )
      throw new Error(
        'Seed revision changed; create a new revision instead of overwriting history',
      )
    const isNew =
      existing.current_revision_id === null && existing.status === 'draft'
    // Seeded attempts keep their original revision. Publish provenance on a new revision.
    const isLegacy =
      existing.current_revision_id === originalRevisionId &&
      existing.status === 'approved' &&
      !existing.has_provenance
    if (!isNew && !isLegacy) continue

    const rid = isLegacy ? id(6, index + 1) : originalRevisionId
    const revisionHash = isLegacy
      ? createHash('sha256')
          .update(JSON.stringify({ fixture, sourceId, locator }))
          .digest('hex')
      : hash
    await client.query(
      `INSERT INTO question_revisions(id,question_id,rev_no,stem,payload,explanation,content_hash,created_by)
       SELECT $1,$2,COALESCE(max(rev_no),0)+1,$3,$4,$5,$6,$7 FROM question_revisions WHERE question_id=$2
       ON CONFLICT(id) DO NOTHING`,
      [
        rid,
        qid,
        fixture.stem,
        JSON.stringify({
          synthetic: true,
          sources: [
            {
              title: sourceTitle,
              locator,
            },
          ],
        }),
        fixture.explanation,
        revisionHash,
        DEV_USER_ID,
      ],
    )
    const saved = await client.query<{ content_hash: string }>(
      'SELECT content_hash FROM question_revisions WHERE id=$1',
      [rid],
    )
    if (saved.rows[0]?.content_hash !== revisionHash)
      throw new Error(
        'Seed revision changed; create a new revision instead of overwriting history',
      )
    for (const choice of choices)
      await client.query(
        'INSERT INTO question_choices(revision_id,label,text,is_correct) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [rid, choice.label, choice.text, choice.is_correct],
      )
    await client.query(
      `INSERT INTO question_sources(revision_id,source_id,locator)
       SELECT $1,$2,$3 WHERE NOT EXISTS
       (SELECT 1 FROM question_sources WHERE revision_id=$1 AND source_id=$2 AND locator=$3)`,
      [rid, sourceId, locator],
    )
    if (isNew)
      await client.query(
        "UPDATE questions SET current_revision_id=$2,status='verified' WHERE id=$1",
        [qid, rid],
      )
    await client.query(
      `UPDATE questions
       SET current_revision_id=$2,status='approved',version=version+$3,updated_at=now()
       WHERE id=$1`,
      [qid, rid, isLegacy ? 1 : 0],
    )
    await client.query(
      'INSERT INTO question_topics(question_id,topic_id,subject_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
      [qid, id(2, fixture.topic + 1), id(1, 1)],
    )
  }
  await client.query(
    `INSERT INTO exam_blueprints(id,subject_id,name,status,spec)
    VALUES('00000000-0000-4000-8000-000000000505',$1,'Đề tổng hợp minh họa','active',$2::jsonb)
    ON CONFLICT(id) DO NOTHING`,
    [
      id(1, 1),
      JSON.stringify({
        duration_seconds: 600,
        deadline_policy: 'expired_grade_saved',
        slots: [{ count: 10 }],
      }),
    ],
  )
  await client.query(
    `INSERT INTO subjects(code,name) VALUES('gpsl','Giải phẫu sinh lý') ON CONFLICT(code) DO NOTHING`,
  )
  await client.query(
    `INSERT INTO exam_blueprints(id,subject_id,name,status,spec)
    SELECT '00000000-0000-4000-8000-000000000506',id,'GPSL — cấu hình 120 câu / 60 phút (chờ ngân hàng phù hợp)','draft',$1::jsonb
    FROM subjects WHERE code='gpsl' ON CONFLICT(id) DO NOTHING`,
    [
      JSON.stringify({
        duration_seconds: 3600,
        deadline_policy: 'expired_grade_saved',
        slots: [{ count: 120 }],
      }),
    ],
  )
  await client.query('COMMIT')
  console.log(
    'Seed ready: 1 synthetic subject, 10 MCQs; existing attempts preserved.',
  )
} catch (error) {
  await client.query('ROLLBACK')
  throw error
} finally {
  client.release()
  await closeMaintenance()
}
