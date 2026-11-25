import { randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import {
  canView,
  effectiveAudience,
  type ViewerTier,
} from '../../packages/core/src/audience'
import { registerIdentity } from '../../packages/db/src/auth'
import { closeDb, DEV_USER_ID, getPool } from '../../packages/db/src/client'
import {
  changeSourceAudience,
  getAsset,
  setInvitation,
} from '../../packages/db/src/content'
import { progress } from '../../packages/db/src/learning'
import {
  closeMaintenance,
  getMaintenancePool,
  loadMaintenanceEnv,
} from '../../packages/db/src/maintenance'
import {
  answerItem,
  createAttempt,
  getAttempt,
  subjects,
  submitAttempt,
} from '../../packages/db/src/practice'

loadMaintenanceEnv()
afterAll(async () => {
  await closeDb()
  await closeMaintenance()
})

test('an invitation only binds a verified Google account and revocation filters pinned items and result replays', async () => {
  const db = getMaintenancePool()
  const email = `audience-${randomUUID()}@example.invalid`
  const source = (
    await db.query<{ id: string }>(
      "SELECT id FROM sources WHERE fingerprint='synthetic:practice-fixtures' AND audience='public'",
    )
  ).rows[0]!
  const registerGoogle = (mail: string) =>
    registerIdentity({
      provider: 'google',
      subject: randomUUID(),
      email: mail,
      name: 'Synthetic Google',
      role: 'learner',
    })
  const guestId = randomUUID()
  const guest = (await registerIdentity({
    provider: 'guest',
    subject: guestId,
    email: `${guestId}@guest.invalid`,
    name: 'Synthetic Guest',
    role: 'learner',
  }))!
  const outsider = (await registerGoogle(
    `outsider-${randomUUID()}@example.invalid`,
  ))!
  const admin = (await registerIdentity({
    provider: 'test',
    subject: randomUUID(),
    email: `admin-${randomUUID()}@example.invalid`,
    name: 'Synthetic Admin',
    role: 'admin',
  }))!
  const blueprint = (
    await db.query<{ id: string }>(
      "SELECT b.id FROM exam_blueprints b JOIN subjects s ON s.id=b.subject_id WHERE s.code='synthetic' AND b.status='active'",
    )
  ).rows[0]!
  const mock = {
    subject: 'synthetic',
    mode: 'mock',
    blueprint_id: blueprint.id,
    type: 'mcq',
    count: 10,
  } as const
  const practice = {
    subject: 'synthetic',
    mode: 'practice',
    type: 'mcq',
    count: 1,
  } as const
  const count = async (id: string, allowAdmin = true) =>
    (await subjects(id, allowAdmin)).items.find(
      (item) => item.code === 'synthetic',
    )?.question_count
  const setAudience = (value: string) =>
    db.query('UPDATE sources SET audience=$2 WHERE id=$1', [source.id, value])
  const key = randomUUID()
  try {
    await expect(
      setInvitation({ email, action: 'invite' }, outsider.id, randomUUID()),
    ).rejects.toMatchObject({ status: 403 })
    expect(
      await setInvitation({ email, action: 'invite' }, admin.id, randomUUID()),
    ).toEqual({ changed: true })
    expect(
      await setInvitation({ email, action: 'invite' }, admin.id, randomUUID()),
    ).toEqual({ changed: false })
    await setInvitation(
      { email: guest.email, action: 'invite' },
      admin.id,
      randomUUID(),
    )
    await getPool().query('SELECT bind_class_invitation($1)', [guest.id])
    const member = (await registerGoogle(email))!
    expect(
      (
        await db.query('SELECT user_id FROM class_invitations WHERE email=$1', [
          email,
        ])
      ).rows[0].user_id,
    ).toBe(member.id)
    expect(
      (
        await db.query('SELECT user_id FROM class_invitations WHERE email=$1', [
          guest.email,
        ])
      ).rows[0].user_id,
    ).toBeNull()
    await expect(
      getPool().query('SELECT email FROM class_invitations'),
    ).rejects.toMatchObject({ code: '42501' })
    await setAudience('class')
    expect(await count(guest.id)).toBe(0)
    expect(await count(outsider.id)).toBe(0)
    expect(await count(admin.id, false)).toBe(0)
    expect(await count(admin.id)).toBe(10)
    expect(await count(member.id)).toBe(10)
    await expect(
      createAttempt(practice, randomUUID(), outsider.id),
    ).rejects.toMatchObject({ code: 'insufficient_questions' })
    const { attempt } = await createAttempt(mock, key, member.id)
    expect(attempt.items).toHaveLength(10)
    const graded = await submitAttempt(attempt.id, member.id)
    expect(graded.feedback).toHaveLength(10)
    expect(graded.by_topic.length).toBeGreaterThan(0)
    expect(
      await setInvitation({ email, action: 'revoke' }, admin.id, randomUUID()),
    ).toEqual({ changed: true })
    expect(await count(member.id)).toBe(0)
    expect((await getAttempt(attempt.id, member.id)).items).toEqual([])
    expect((await createAttempt(mock, key, member.id)).attempt.items).toEqual(
      [],
    )
    await expect(
      answerItem(attempt.id, 1, 'A', undefined, member.id),
    ).rejects.toMatchObject({ status: 404 })
    expect(await submitAttempt(attempt.id, member.id)).toMatchObject({
      total: 10,
      score: graded.score,
      by_topic: [],
      feedback: [],
    })
    expect((await progress(member.id, 'synthetic')).items).toEqual([])
    await expect(
      createAttempt(
        { ...practice, mode: 'review', source: 'wrong' },
        randomUUID(),
        member.id,
      ),
    ).rejects.toMatchObject({ code: 'insufficient_questions' })
  } finally {
    await setAudience('public')
    await db.query('DELETE FROM class_invitations WHERE email IN ($1,$2)', [
      email,
      guest.email,
    ])
  }
})

test('widening a source requires approved rights and rejects stale audience edits', async () => {
  const db = await getMaintenancePool().connect()
  try {
    await db.query('BEGIN')
    const id = randomUUID(),
      admin = randomUUID(),
      learner = randomUUID()
    await db.query(
      "INSERT INTO users(id,email,display_name,role) VALUES($1,$1::uuid::text||'@example.invalid','Synthetic','admin'),($2,$2::uuid::text||'@example.invalid','Synthetic','learner')",
      [admin, learner],
    )
    await db.query(
      "INSERT INTO sources(id,subject_id,kind,title,locator,license,retrieved_at,fingerprint) SELECT $1,id,'manual','fixture','fixture','CC0',now(),$1::uuid::text FROM subjects WHERE code='synthetic'",
      [id],
    )
    const input = {
      id,
      audience: 'public',
      expected_audience: 'owner_only',
      rights_basis: 'Synthetic license record',
    } as const
    await expect(
      changeSourceAudience(input, learner, randomUUID(), db),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      changeSourceAudience(input, admin, randomUUID(), db),
    ).rejects.toMatchObject({ code: 'rights_confirmation_required' })
    await db.query("UPDATE sources SET review_status='approved' WHERE id=$1", [
      id,
    ])
    await expect(
      changeSourceAudience(
        { ...input, rights_basis: undefined },
        admin,
        randomUUID(),
        db,
      ),
    ).rejects.toMatchObject({ code: 'rights_confirmation_required' })
    expect(
      await changeSourceAudience(input, admin, randomUUID(), db),
    ).toMatchObject({
      audience: 'public',
      audience_rights_basis: input.rights_basis,
    })
    await expect(
      changeSourceAudience(
        { ...input, audience: 'class' },
        admin,
        randomUUID(),
        db,
      ),
    ).rejects.toMatchObject({ status: 409 })
    const row = (
      await db.query('SELECT diff FROM audit_logs WHERE entity_id=$1', [id])
    ).rows[0]
    expect(row.diff).toMatchObject({
      from_audience: 'owner_only',
      to_audience: 'public',
      rights_basis_sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(JSON.stringify(row.diff)).not.toContain(input.rights_basis)
  } finally {
    await db.query('ROLLBACK')
    db.release()
  }
})

test('the database follows the strictest linked audience, including an asset source, and hides revisions without sources', async () => {
  const db = await getMaintenancePool().connect()
  try {
    await db.query('BEGIN')
    const revision = randomUUID(),
      noSources = randomUUID()
    const ids = await db.query(
      "SELECT s.id AS subject,q.id AS question FROM subjects s JOIN questions q ON q.subject_id=s.id WHERE s.code='synthetic' ORDER BY q.id LIMIT 1",
    )
    const { subject, question } = ids.rows[0]
    // Rollback before deferred MCQ checks, since only the provenance policy is exercised here.
    for (const [index, id] of [revision, noSources].entries())
      await db.query(
        "INSERT INTO question_revisions(id,question_id,rev_no,stem,explanation,content_hash,created_by) VALUES($1,$2,$3,'fixture','fixture',$4,$5)",
        [id, question, 100 + index, id, DEV_USER_ID],
      )
    const sources = []
    for (const audience of ['public', 'class', 'owner_only'] as const) {
      const id = randomUUID()
      await db.query(
        "INSERT INTO sources(id,subject_id,kind,title,locator,license,review_status,retrieved_at,fingerprint,audience) VALUES($1::uuid,$2,'manual','fixture','fixture','CC0','approved',now(),$1::uuid::text,$3)",
        [id, subject, audience],
      )
      sources.push(id)
    }
    for (const source of sources.slice(0, 2))
      await db.query(
        "INSERT INTO question_sources(revision_id,source_id,locator) VALUES($1,$2,'fixture')",
        [revision, source],
      )
    const tiers: ViewerTier[] = [null, 'public', 'class', 'owner_only']
    const readable = async (id: string) =>
      (
        await db.query(
          'SELECT can_view_revision($1,$2,tier) allowed FROM generate_series(0,3) tier ORDER BY tier',
          [id, subject],
        )
      ).rows.map((row) => row.allowed)
    expect(await readable(revision)).toEqual(
      tiers.map((tier) =>
        canView(tier, effectiveAudience(['public', 'class'])),
      ),
    )
    const assetId = randomUUID()
    await db.query(
      "INSERT INTO assets(id,kind,storage_key,mime,width,height,source_id,license,attribution,alt_text,sha256,data) VALUES($1::uuid,'png',$1::uuid::text,'image/png',1,1,$2,'CC0','fixture','fixture',$1::uuid::text,''::bytea)",
      [assetId, sources[2]],
    )
    await db.query(
      'INSERT INTO question_assets(revision_id,asset_id) VALUES($1,$2)',
      [revision, assetId],
    )
    expect(await readable(revision)).toEqual(
      tiers.map((tier) =>
        canView(tier, effectiveAudience(['public', 'class', 'owner_only'])),
      ),
    )
    expect(await readable(noSources)).toEqual(
      tiers.map((tier) => canView(tier, effectiveAudience([]))),
    )
    const pinned = (
      await db.query(
        "INSERT INTO attempts(user_id,subject_id,mode,idempotency_key,request_hash) VALUES($1,$2,'practice',$3,'fixture') RETURNING id",
        [DEV_USER_ID, subject, randomUUID()],
      )
    ).rows[0].id
    await db.query(
      'INSERT INTO attempt_items(attempt_id,position,question_revision_id) VALUES($1,1,$2)',
      [pinned, revision],
    )
    const learner = { id: DEV_USER_ID, role: 'learner', status: 'active' }
    await expect(getAsset(assetId, learner, db)).rejects.toMatchObject({
      status: 404,
    })
    await db.query(
      "UPDATE sources SET audience='public' WHERE id=ANY($1::uuid[])",
      [sources],
    )
    expect((await getAsset(assetId, learner, db)).mime).toBe('image/png')
    await db.query("UPDATE sources SET review_status='rejected' WHERE id=$1", [
      sources[0],
    ])
    expect(await readable(revision)).toEqual([false, false, false, true])
    await expect(getAsset(assetId, learner, db)).rejects.toMatchObject({
      status: 404,
    })
  } finally {
    await db.query('ROLLBACK')
    db.release()
  }
})
