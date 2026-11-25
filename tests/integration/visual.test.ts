import { randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import { patchQuestionRevisionSchema } from '../../packages/api-contract/src/bundle'
import {
  importBundle,
  patchQuestion,
  questionDetail,
  reviewSource,
  changeSourceAudience,
} from '../../packages/db/src/content'
import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from '../../packages/db/src/maintenance'
import {
  answerItem,
  createAttempt,
  submitAttempt,
} from '../../packages/db/src/practice'

loadMaintenanceEnv()
afterAll(closeMaintenance)

test('licensed visuals import as drafts, hide grading data, and grade name variants and both hotspot input methods', async () => {
  const db = await getMaintenancePool().connect()
  try {
    await db.query('BEGIN')
    const teacher = randomUUID(),
      student = randomUUID(),
      reviewer = randomUUID(),
      subject = 'visual-fixture-' + randomUUID()
    for (const [id, role] of [
      [teacher, 'admin'],
      [student, 'learner'],
      [reviewer, 'learner'],
    ])
      await db.query(
        "INSERT INTO users(id,email,display_name,role) VALUES($1,$1::uuid::text||'@example.invalid','Synthetic fixture',$2)",
        [id, role],
      )
    const source = {
      ref: 'synthetic-source',
      kind: 'manual',
      title: 'Synthetic fixture',
      locator: 'fixture',
      license: 'project-authored',
      retrieved_at: new Date().toISOString(),
    }
    const common = {
      difficulty: 1,
      explanation: 'Synthetic comparison',
      topic_codes: ['visual'],
      sources: [{ source_ref: source.ref, locator: 'fixture' }],
    }
    const svg = (path: string) =>
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><path d="${path}" stroke="black"/></svg>`,
      ).toString('base64')
    const asset = (ref: string, path: string) => ({
      ref,
      kind: 'svg',
      data_base64: svg(path),
      license: 'project-authored',
      attribution: 'Synthetic fixture',
      alt_text: 'Abstract demonstration',
      source_ref: source.ref,
    })
    const bundle = {
      schema_version: 1,
      manifest: {
        subject,
        label: 'Synthetic visual bank',
        generator: { name: 'fixture', version: '1' },
        created_at: new Date().toISOString(),
      },
      topics: [
        {
          code: 'visual',
          title: 'Synthetic visual topic',
          parent_code: null,
          sort_order: 0,
        },
      ],
      sources: [source],
      assets: [asset('structure', 'M1 1 L9 9'), asset('diagram', 'M1 9 L9 1')],
      questions: [
        {
          ...common,
          external_id: 'name',
          type: 'name_from_structure',
          stem: 'Name the synthetic structure',
          visual: { type: 'name_from_structure', smiles: 'CC[C@@H](C)O' },
          asset_refs: ['structure'],
          accepted_answers: ['(2R)-butan-2-ol', '(2R)-2-butanol'],
        },
        {
          ...common,
          external_id: 'hotspot',
          type: 'image_hotspot',
          stem: 'Select the marked part of this abstract diagram',
          visual: {
            type: 'image_hotspot',
            hotspot: {
              mode: 'click',
              correct_region: 'first',
              regions: [
                {
                  id: 'first',
                  label: 'First region',
                  points: [
                    [0, 0],
                    [0.4, 0],
                    [0.4, 0.4],
                    [0, 0.4],
                  ],
                },
                {
                  id: 'second',
                  label: 'Second region',
                  points: [
                    [0.6, 0.6],
                    [1, 0.6],
                    [1, 1],
                    [0.6, 1],
                  ],
                },
              ],
            },
          },
          asset_refs: ['diagram'],
        },
      ],
    }
    await expect(
      importBundle(
        {
          ...bundle,
          assets: bundle.assets.map((item) => ({
            ...item,
            source_ref: undefined,
          })),
        },
        teacher,
        randomUUID(),
        db,
      ),
    ).rejects.toThrow('linked provenance')
    const imported = await importBundle(bundle, teacher, randomUUID(), db)
    const questions = await db.query<{ id: string; external_id: string }>(
      'SELECT question_id AS id,external_id FROM import_questions WHERE import_id=$1',
      [imported.import_id],
    )
    expect(questions.rowCount).toBe(2)
    const s = (
      await db.query<{ id: string }>(
        'SELECT id FROM sources WHERE title=$1 AND subject_id=(SELECT id FROM subjects WHERE code=$2)',
        [source.title, subject],
      )
    ).rows[0]!
    await reviewSource(
      { id: s.id, review_status: 'approved' },
      teacher,
      randomUUID(),
      db,
    )
    for (const q of questions.rows) {
      const draft = await questionDetail(q.id, db)
      expect(draft.status).toBe('draft')
      const verified = await patchQuestion(
        q.id,
        { expected_version: draft.version, status: 'verified' },
        teacher,
        randomUUID(),
        db,
      )
      await patchQuestion(
        q.id,
        { expected_version: verified.version, status: 'approved' },
        teacher,
        randomUUID(),
        db,
      )
    }
    await expect(
      createAttempt(
        { subject, mode: 'practice', type: 'name_from_structure', count: 1 },
        randomUUID(),
        student,
        randomUUID(),
        db,
      ),
    ).rejects.toMatchObject({ code: 'insufficient_questions' })
    await changeSourceAudience(
      {
        id: s.id,
        audience: 'public',
        expected_audience: 'owner_only',
        rights_basis: 'Authored synthetic fixture',
      },
      teacher,
      randomUUID(),
      db,
    )
    const start = async (
      type: 'name_from_structure' | 'image_hotspot',
      userId = student,
    ) =>
      (
        await createAttempt(
          { subject, mode: 'practice', type, count: 1 },
          randomUUID(),
          userId,
          randomUUID(),
          db,
        )
      ).attempt
    const name = await start('name_from_structure')
    expect(JSON.stringify(name)).not.toMatch(
      /butan-2-ol|2-butanol|smiles|is_correct/,
    )
    expect(name.items[0]?.assets[0]?.alt_text).toBe(
      'Sơ đồ liên kết của hợp chất',
    )
    expect(
      await answerItem(
        name.id,
        1,
        { kind: 'name', text: '  ( 2R ) – 2-BUTANOL  ' },
        undefined,
        student,
        randomUUID(),
        true,
        db,
      ),
    ).toMatchObject({ is_correct: true, correct_answer: '(2R)-butan-2-ol' })
    expect(
      (await submitAttempt(name.id, student, randomUUID(), db)).score,
    ).toBe(10)
    const wrongName = await start('name_from_structure')
    expect(
      await answerItem(
        wrongName.id,
        1,
        { kind: 'name', text: '(2r)-butan-2-ol' },
        undefined,
        student,
        randomUUID(),
        true,
        db,
      ),
    ).toMatchObject({ is_correct: false, correct_answer: '(2R)-butan-2-ol' })
    expect(
      (await submitAttempt(wrongName.id, student, randomUUID(), db)).score,
    ).toBe(0)
    const existingAttempt = await start('name_from_structure')
    const questionId = questions.rows.find((q) => q.external_id === 'name')!.id
    const before = await questionDetail(questionId, db)
    const revision = patchQuestionRevisionSchema.parse({
      stem: before.revision.stem,
      explanation: before.revision.explanation,
      difficulty: before.revision.difficulty,
      visual: before.revision.visual,
      topic_codes: before.revision.topic_codes,
      sources: before.revision.sources.map((source) => ({
        source_id: source.id,
        locator: source.locator,
      })),
      asset_ids: before.revision.assets.map((asset) => asset.id),
      accepted_answers: [...before.revision.accepted_answers].reverse(),
    })
    const duplicateTypography = patchQuestionRevisionSchema.parse({
      ...revision,
      accepted_answers: ['(2R)-butan-2-ol', '( 2R ) – butan – 2 – ol'],
    })
    await expect(
      patchQuestion(
        questionId,
        { expected_version: before.version, revision: duplicateTypography },
        teacher,
        randomUUID(),
        db,
      ),
    ).rejects.toMatchObject({ code: 'validation_failed', status: 422 })
    const afterRejectedEdit = await questionDetail(questionId, db)
    expect(afterRejectedEdit.version).toBe(before.version)
    expect(afterRejectedEdit.revision.id).toBe(before.revision.id)
    expect(afterRejectedEdit.revision.accepted_answers).toEqual(
      before.revision.accepted_answers,
    )
    const renamed = await patchQuestion(
      questionId,
      { expected_version: before.version, revision },
      teacher,
      randomUUID(),
      db,
    )
    expect(renamed.status).toBe('draft')
    expect(renamed.revision.id).not.toBe(before.revision.id)
    expect(renamed.revision.accepted_answers).toEqual([
      '(2R)-2-butanol',
      '(2R)-butan-2-ol',
    ])
    await expect(
      patchQuestion(
        questionId,
        { expected_version: renamed.version, revision },
        teacher,
        randomUUID(),
        db,
      ),
    ).rejects.toMatchObject({ code: 'duplicate_content' })
    const verified = await patchQuestion(
      questionId,
      { expected_version: renamed.version, status: 'verified' },
      teacher,
      randomUUID(),
      db,
    )
    await patchQuestion(
      questionId,
      { expected_version: verified.version, status: 'approved' },
      teacher,
      randomUUID(),
      db,
    )
    const newAttempt = await start('name_from_structure')
    for (const [attemptId, primary] of [
      [existingAttempt.id, '(2R)-butan-2-ol'],
      [newAttempt.id, '(2R)-2-butanol'],
    ] as const) {
      expect(
        await answerItem(
          attemptId,
          1,
          { kind: 'name', text: '(2R)-butan-2-ol' },
          undefined,
          student,
          randomUUID(),
          true,
          db,
        ),
      ).toMatchObject({ is_correct: true, correct_answer: primary })
    }
    const replay = await importBundle(
      {
        ...bundle,
        manifest: { ...bundle.manifest, label: 'Synthetic duplicate fixture' },
      },
      teacher,
      randomUUID(),
      db,
    )
    expect(replay.counts).toEqual({ created: 0, duplicates: 2 })
    const beforeAlternateEdit = await start('name_from_structure')
    const current = await questionDetail(questionId, db)
    const restored = await patchQuestion(
      questionId,
      {
        expected_version: current.version,
        revision: {
          ...revision,
          accepted_answers: before.revision.accepted_answers,
        },
      },
      teacher,
      randomUUID(),
      db,
    )
    expect(restored.status).toBe('draft')
    expect(restored.revision.id).not.toBe(before.revision.id)
    expect(restored.revision.id).not.toBe(renamed.revision.id)
    expect(restored.revision.accepted_answers).toEqual(
      before.revision.accepted_answers,
    )
    const alternate = {
      ...revision,
      accepted_answers: ['(2R)-butan-2-ol', '(2r)-2-butanol'],
    }
    const alternateEdited = await patchQuestion(
      questionId,
      { expected_version: restored.version, revision: alternate },
      teacher,
      randomUUID(),
      db,
    )
    expect(alternateEdited.revision.id).not.toBe(restored.revision.id)
    expect(alternateEdited.revision.accepted_answers).toEqual(
      alternate.accepted_answers,
    )
    const alternateVerified = await patchQuestion(
      questionId,
      { expected_version: alternateEdited.version, status: 'verified' },
      teacher,
      randomUUID(),
      db,
    )
    await patchQuestion(
      questionId,
      { expected_version: alternateVerified.version, status: 'approved' },
      teacher,
      randomUUID(),
      db,
    )
    const afterAlternateEdit = await start('name_from_structure')
    for (const [attempt, isCorrect] of [
      [beforeAlternateEdit, false],
      [afterAlternateEdit, true],
    ] as const) {
      expect(
        await answerItem(
          attempt.id,
          1,
          { kind: 'name', text: '(2r)-2-butanol' },
          undefined,
          student,
          randomUUID(),
          true,
          db,
        ),
      ).toMatchObject({ is_correct: isCorrect })
    }
    for (const answer of [
      { kind: 'region', id: 'first' },
      { kind: 'point', point: [0.2, 0.2] },
    ] as const) {
      const hotspot = await start('image_hotspot')
      expect(JSON.stringify(hotspot)).not.toMatch(/correct_region|points/)
      const submitted =
        answer.kind === 'point'
          ? {
              kind: 'point' as const,
              point: [...answer.point] as [number, number],
            }
          : answer
      expect(
        await answerItem(
          hotspot.id,
          1,
          submitted,
          undefined,
          student,
          randomUUID(),
          true,
          db,
        ),
      ).toMatchObject({ is_correct: true, correct_answer: 'First region' })
    }
    const flaggedName = await start('name_from_structure', reviewer)
    const flaggedHotspot = await start('image_hotspot', reviewer)
    for (const attempt of [flaggedName, flaggedHotspot])
      await answerItem(
        attempt.id,
        1,
        undefined,
        true,
        reviewer,
        randomUUID(),
        false,
        db,
      )
    const review = (
      await createAttempt(
        { subject, mode: 'review', source: 'flagged', type: 'mcq', count: 2 },
        randomUUID(),
        reviewer,
        randomUUID(),
        db,
        false,
      )
    ).attempt
    expect(review.items.map((item) => item.exercise?.type).sort()).toEqual([
      'image_hotspot',
      'name_from_structure',
    ])
    expect(JSON.stringify(review)).not.toMatch(
      /correct_region|is_correct|2-butanol/,
    )
    await db.query('SET CONSTRAINTS ALL IMMEDIATE')
  } finally {
    await db.query('ROLLBACK')
    db.release()
  }
})
