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
    const qid = id(3, index + 1),
      rid = id(4, index + 1)
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
    await client.query(
      'INSERT INTO question_revisions(id,question_id,rev_no,stem,payload,explanation,content_hash,created_by) VALUES($1,$2,1,$3,$4,$5,$6,$7) ON CONFLICT(id) DO NOTHING',
      [
        rid,
        qid,
        fixture.stem,
        JSON.stringify({
          synthetic: true,
          sources: [
            {
              title: 'Fixture tổng hợp do tác giả dự án tự viết',
              locator: `content/fixtures/practice.json, câu ${index + 1}`,
            },
          ],
        }),
        fixture.explanation,
        hash,
        DEV_USER_ID,
      ],
    )
    const saved = await client.query<{ content_hash: string }>(
      'SELECT content_hash FROM question_revisions WHERE id=$1',
      [rid],
    )
    if (saved.rows[0]?.content_hash !== hash)
      throw new Error(
        'Seed revision changed; create a new revision instead of overwriting history',
      )
    for (const choice of choices)
      await client.query(
        'INSERT INTO question_choices(revision_id,label,text,is_correct) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [rid, choice.label, choice.text, choice.is_correct],
      )
    await client.query(
      "UPDATE questions SET current_revision_id=$2,status='approved' WHERE id=$1 AND current_revision_id IS NULL AND status='draft'",
      [qid, rid],
    )
    await client.query(
      'INSERT INTO question_topics(question_id,topic_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
      [qid, id(2, fixture.topic + 1)],
    )
  }
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
