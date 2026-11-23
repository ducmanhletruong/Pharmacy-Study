import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from '../../packages/db/src/maintenance'
import { randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import { DEV_USER_ID } from '../../packages/db/src/client'

loadMaintenanceEnv()
afterAll(closeMaintenance)

type Client = Awaited<
  ReturnType<ReturnType<typeof getMaintenancePool>['connect']>
>
const labels = ['A', 'B', 'C', 'D']

async function seeded() {
  const result = await getMaintenancePool().query<{
    id: string
    subject_id: string
    current_revision_id: string
  }>(
    "SELECT id,subject_id,current_revision_id FROM questions WHERE status='approved' LIMIT 1",
  )
  return result.rows[0]!
}
async function addRevision(
  client: Client,
  questionId: string,
  revNo: number,
  texts: string[],
  correct: string[],
) {
  const rid = randomUUID()
  await client.query(
    "INSERT INTO question_revisions(id,question_id,rev_no,stem,explanation,content_hash,created_by) VALUES($1,$2,$3,'test stem','test-only',$4,$5)",
    [rid, questionId, revNo, randomUUID(), DEV_USER_ID],
  )
  for (const [i, label] of labels.entries())
    await client.query(
      'INSERT INTO question_choices(revision_id,label,text,is_correct) VALUES($1,$2,$3,$4)',
      [rid, label, texts[i], correct.includes(label)],
    )
  return rid
}
// Mọi thay đổi trong test này luôn bị ROLLBACK; không để lại dữ liệu.
async function rolledBack(run: (client: Client) => Promise<unknown>) {
  const client = await getMaintenancePool().connect()
  try {
    await client.query('BEGIN')
    await run(client)
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

test('a revision without choices cannot be committed', async () => {
  const q = await seeded()
  await expect(
    getMaintenancePool().query(
      "INSERT INTO question_revisions(id,question_id,rev_no,stem,explanation,content_hash,created_by) VALUES($1,$2,998,'no choices','test-only',$3,$4)",
      [randomUUID(), q.id, randomUUID(), DEV_USER_ID],
    ),
  ).rejects.toMatchObject({ code: '23514' })
})

test('a revision with no correct choice is rejected at commit', async () => {
  const q = await seeded()
  await expect(
    rolledBack(async (client) => {
      await addRevision(client, q.id, 997, ['a1', 'b1', 'c1', 'd1'], [])
      await client.query('SET CONSTRAINTS ALL IMMEDIATE')
    }),
  ).rejects.toMatchObject({ code: '23514' })
})

test('duplicate choice texts are rejected at commit', async () => {
  const q = await seeded()
  await expect(
    rolledBack(async (client) => {
      await addRevision(
        client,
        q.id,
        996,
        ['same', ' SAME ', 'c1', 'd1'],
        ['A'],
      )
      await client.query('SET CONSTRAINTS ALL IMMEDIATE')
    }),
  ).rejects.toMatchObject({ code: '23505' })
})

test('a second correct choice is rejected by the unique index', async () => {
  const q = await seeded()
  await expect(
    rolledBack((client) =>
      addRevision(client, q.id, 995, ['a1', 'b1', 'c1', 'd1'], ['A', 'B']),
    ),
  ).rejects.toMatchObject({ code: '23505' })
})

test('choices and revisions of an approved question are sealed', async () => {
  const q = await seeded()
  await expect(
    getMaintenancePool().query(
      "UPDATE question_choices SET text='changed' WHERE revision_id=$1 AND label='A'",
      [q.current_revision_id],
    ),
  ).rejects.toMatchObject({ code: '23001' })
  await expect(
    getMaintenancePool().query(
      "UPDATE question_revisions SET explanation='changed' WHERE id=$1",
      [q.current_revision_id],
    ),
  ).rejects.toMatchObject({ code: '23001' })
  await expect(
    getMaintenancePool().query(
      'DELETE FROM question_choices WHERE revision_id=$1',
      [q.current_revision_id],
    ),
  ).rejects.toMatchObject({ code: '23001' })
})

test('a draft revision stays editable until the question leaves draft', async () => {
  const q = await seeded()
  await rolledBack(async (client) => {
    const question = randomUUID()
    await client.query(
      "INSERT INTO questions(id,subject_id,type,difficulty,status) VALUES($1,$2,'mcq',1,'draft')",
      [question, q.subject_id],
    )
    const rid = await addRevision(
      client,
      question,
      1,
      ['a1', 'b1', 'c1', 'd1'],
      ['A'],
    )
    await client.query(
      'UPDATE questions SET current_revision_id=$1 WHERE id=$2',
      [rid, question],
    )
    await client.query(
      "UPDATE question_revisions SET explanation='edited' WHERE id=$1",
      [rid],
    )
    const source = randomUUID()
    await client.query(
      "INSERT INTO sources(id,subject_id,kind,title,locator,license,review_status,retrieved_at,fingerprint) VALUES($1,$2,'manual','integrity fixture','fixture','CC0','approved',now(),$3)",
      [source, q.subject_id, randomUUID()],
    )
    await client.query(
      "INSERT INTO question_sources(revision_id,source_id,locator) VALUES($1,$2,'fixture')",
      [rid, source],
    )
    await client.query("UPDATE questions SET status='verified' WHERE id=$1", [
      question,
    ])
    await expect(
      client.query(
        "UPDATE question_revisions SET explanation='edited again' WHERE id=$1",
        [rid],
      ),
    ).rejects.toMatchObject({ code: '23001' })
  })
})

test('a topic from another subject cannot be linked to a question', async () => {
  const q = await seeded()
  await expect(
    rolledBack(async (client) => {
      const subject = randomUUID(),
        topic = randomUUID()
      await client.query(
        "INSERT INTO subjects(id,code,name) VALUES($1,$2,'other')",
        [subject, `tmp-${subject}`],
      )
      await client.query(
        "INSERT INTO topics(id,subject_id,parent_id,code,title) VALUES($1,$2,NULL,'x','x')",
        [topic, subject],
      )
      await client.query(
        'INSERT INTO question_topics(question_id,topic_id,subject_id) VALUES($1,$2,$3)',
        [q.id, topic, q.subject_id],
      )
    }),
  ).rejects.toMatchObject({ code: '23503' })
})

test('a superseded draft revision cannot be edited or deleted', async () => {
  const q = await seeded()
  await rolledBack(async (client) => {
    const question = randomUUID()
    await client.query(
      "INSERT INTO questions(id,subject_id,type,difficulty,status) VALUES($1,$2,'mcq',1,'draft')",
      [question, q.subject_id],
    )
    const old = await addRevision(
      client,
      question,
      1,
      ['a', 'b', 'c', 'd'],
      ['A'],
    )
    const current = await addRevision(
      client,
      question,
      2,
      ['a2', 'b2', 'c2', 'd2'],
      ['A'],
    )
    await client.query(
      'UPDATE questions SET current_revision_id=$1 WHERE id=$2',
      [current, question],
    )
    await expect(
      client.query('DELETE FROM question_revisions WHERE id=$1', [old]),
    ).rejects.toMatchObject({ code: '23001' })
  })
})
test('an attempted draft revision is sealed even while it is current', async () => {
  const q = await seeded()
  await rolledBack(async (client) => {
    const question = randomUUID(),
      attempt = randomUUID()
    await client.query(
      "INSERT INTO questions(id,subject_id,type,difficulty,status) VALUES($1,$2,'mcq',1,'draft')",
      [question, q.subject_id],
    )
    const rid = await addRevision(
      client,
      question,
      1,
      ['a', 'b', 'c', 'd'],
      ['A'],
    )
    await client.query(
      'UPDATE questions SET current_revision_id=$1 WHERE id=$2',
      [rid, question],
    )
    await client.query(
      "INSERT INTO attempts(id,user_id,subject_id,mode,idempotency_key,request_hash) VALUES($1,$2,$3,'practice',$4,'test')",
      [attempt, DEV_USER_ID, q.subject_id, randomUUID()],
    )
    await client.query(
      'INSERT INTO attempt_items(attempt_id,position,question_revision_id) VALUES($1,1,$2)',
      [attempt, rid],
    )
    await expect(
      client.query(
        "UPDATE question_choices SET text='changed' WHERE revision_id=$1 AND label='A'",
        [rid],
      ),
    ).rejects.toMatchObject({ code: '23001' })
  })
})
test('valid draft choices remain editable but three choices fail deferred validation', async () => {
  const q = await seeded()
  await rolledBack(async (client) => {
    const question = randomUUID()
    await client.query(
      "INSERT INTO questions(id,subject_id,type,difficulty,status) VALUES($1,$2,'mcq',1,'draft')",
      [question, q.subject_id],
    )
    const rid = await addRevision(
      client,
      question,
      1,
      ['a', 'b', 'c', 'd'],
      ['A'],
    )
    await client.query(
      'UPDATE questions SET current_revision_id=$1 WHERE id=$2',
      [rid, question],
    )
    await client.query(
      "UPDATE question_choices SET text='edited' WHERE revision_id=$1 AND label='B'",
      [rid],
    )
    await client.query('SET CONSTRAINTS ALL IMMEDIATE')
    await expect(
      client.query(
        "DELETE FROM question_choices WHERE revision_id=$1 AND label='D'",
        [rid],
      ),
    ).rejects.toMatchObject({ code: '23514' })
  })
})
