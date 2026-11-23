import { randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import { DEV_USER_ID } from '../../packages/db/src/client'
import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from '../../packages/db/src/maintenance'
loadMaintenanceEnv()
afterAll(closeMaintenance)

for (const firstCommits of [true, false])
  test(`concurrent normalized choice texts stay unique when first writer ${firstCommits ? 'commits' : 'rolls back'}`, async () => {
    const pool = getMaintenancePool(),
      admin = await pool.connect()
    const subject = randomUUID(),
      question = randomUUID(),
      revision = randomUUID()
    let created = false
    try {
      await admin.query('BEGIN')
      await admin.query(
        "INSERT INTO subjects(id,code,name) VALUES($1,$2,'concurrency fixture')",
        [subject, `race-${subject}`],
      )
      await admin.query(
        "INSERT INTO questions(id,subject_id,type,difficulty,status) VALUES($1,$2,'mcq',1,'draft')",
        [question, subject],
      )
      await admin.query(
        "INSERT INTO question_revisions(id,question_id,rev_no,stem,explanation,content_hash,created_by) VALUES($1,$2,1,'race','synthetic',$3,$4)",
        [revision, question, randomUUID(), DEV_USER_ID],
      )
      for (const label of ['A', 'B', 'C', 'D'])
        await admin.query(
          'INSERT INTO question_choices(revision_id,label,text,is_correct) VALUES($1,$2,$3,$4)',
          [revision, label, `choice-${label}`, label === 'A'],
        )
      await admin.query(
        'UPDATE questions SET current_revision_id=$1 WHERE id=$2',
        [revision, question],
      )
      await admin.query('COMMIT')
      created = true
      const first = await pool.connect(),
        second = await pool.connect()
      try {
        for (const client of [first, second]) {
          await client.query('BEGIN')
          await client.query(
            "SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='3s'",
          )
        }
        const pid = (await second.query('SELECT pg_backend_pid() pid')).rows[0]
          .pid
        await first.query(
          "UPDATE question_choices SET text='  SAME text  ' WHERE revision_id=$1 AND label='A'",
          [revision],
        )
        let settled = false
        const outcome = second
          .query(
            "UPDATE question_choices SET text='same TEXT' WHERE revision_id=$1 AND label='B'",
            [revision],
          )
          .then(
            () => ({ code: null }),
            (error) => ({ code: (error as { code: string }).code }),
          )
          .finally(() => {
            settled = true
          })
        const deadline = Date.now() + 2000
        let waiting = false
        while (!settled && Date.now() < deadline) {
          waiting =
            (
              await admin.query(
                "SELECT wait_event_type='Lock' waiting FROM pg_stat_activity WHERE pid=$1",
                [pid],
              )
            ).rows[0]?.waiting === true
          if (waiting) break
          await new Promise((resolve) => setTimeout(resolve, 10))
        }
        // Synchronize on the second backend rather than relying on sleep timing.
        expect(waiting || settled).toBe(true)
        await first.query(firstCommits ? 'COMMIT' : 'ROLLBACK')
        const result = await outcome
        if (result.code) await second.query('ROLLBACK')
        else await second.query('COMMIT')
        const counts = (
          await admin.query(
            'SELECT count(*)::int total,count(DISTINCT lower(btrim(text)))::int distinct FROM question_choices WHERE revision_id=$1',
            [revision],
          )
        ).rows[0]
        expect(result.code).toBe(firstCommits ? '23505' : null)
        expect(counts).toEqual({ total: 4, distinct: 4 })
      } finally {
        await first.query('ROLLBACK')
        await second.query('ROLLBACK')
        first.release()
        second.release()
      }
    } finally {
      await admin.query('ROLLBACK')
      if (created) {
        await admin.query('BEGIN')
        await admin.query(
          'UPDATE questions SET current_revision_id=NULL WHERE id=$1',
          [question],
        )
        await admin.query('DELETE FROM question_choices WHERE revision_id=$1', [
          revision,
        ])
        await admin.query('DELETE FROM question_revisions WHERE id=$1', [
          revision,
        ])
        await admin.query('DELETE FROM questions WHERE id=$1', [question])
        await admin.query('DELETE FROM subjects WHERE id=$1', [subject])
        await admin.query('COMMIT')
      }
      admin.release()
    }
  })
