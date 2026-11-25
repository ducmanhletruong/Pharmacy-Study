import { createHash, randomUUID } from 'node:crypto'
import type pg from 'pg'
import {
  bundleSchema,
  patchQuestionRevisionSchema,
  type PatchQuestionRevision,
  type Bundle,
} from '@pharmacy/api-contract/bundle'
import { uuid, type QuestionType } from '@pharmacy/api-contract'
import {
  chemicalNameGradingKey,
  normalizeChemicalName,
} from '@pharmacy/core/name-grading'
import { canView, type Audience } from '@pharmacy/core/audience'
import {
  assertTransition,
  statusAfterReport,
  type QuestionStatus,
} from '@pharmacy/core/lifecycle'
import { getPool, withAccountRows } from './client'
import { appendAudit } from './audit'
import { PracticeError } from './practice'
import { validateAsset } from './asset-safety'

type Client = pg.PoolClient
type Db = Pick<Client, 'query'>
type QuestionRow = {
  id: string
  subject_id: string
  subject: string
  type: QuestionType
  status: QuestionStatus
  version: number
  difficulty: number
  current_revision_id: string
}
const fail = (code: string, status: number, message: string): never => {
  throw new PracticeError(code, status, message)
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
      .join(',')}}`
  return JSON.stringify(value)
}
const hash = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex')
const normalized = (value: string) =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi')
async function tx<T>(
  run: (client: Client) => Promise<T>,
  context?: Client,
): Promise<T> {
  const client = context ?? (await getPool().connect())
  try {
    if (!context) await client.query('BEGIN')
    const value = await run(client)
    if (!context) await client.query('COMMIT')
    return value
  } catch (error) {
    if (!context) await client.query('ROLLBACK')
    const code = (error as { code?: string }).code
    if (code === '23505')
      return fail('conflict', 409, 'Nội dung hoặc thao tác đã tồn tại')
    if (['23514', '23503', '23001'].includes(code ?? ''))
      return fail(
        'invalid_state_transition',
        422,
        'Nội dung chưa đủ điều kiện hoặc lịch sử đã khóa',
      )
    if (['40001', '40P01'].includes(code ?? ''))
      return fail(
        'write_conflict',
        409,
        'Dữ liệu đang được cập nhật. Vui lòng thử lại toàn bộ thao tác.',
      )
    throw error
  } finally {
    if (!context) client.release()
  }
}
async function admin(db: Db, id: string) {
  const row = (
    await db.query(
      "SELECT 1 FROM users WHERE id=$1 AND role='admin' AND status='active'",
      [id],
    )
  ).rows[0]
  if (!row) fail('forbidden', 403, 'Bạn không có quyền quản lý nội dung')
}
async function bankLock(db: Db, subjectId: string) {
  await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
    `content:${subjectId}`,
  ])
}
async function question(db: Db, id: string, lock = false) {
  const row = (
    await db.query<QuestionRow>(
      `SELECT q.*,s.code subject FROM questions q JOIN subjects s ON s.id=q.subject_id WHERE q.id=$1 ${lock ? 'FOR UPDATE OF q' : ''}`,
      [id],
    )
  ).rows[0]
  if (!row) fail('not_found', 404, 'Không tìm thấy câu hỏi')
  return row!
}
async function lockedQuestion(db: Db, id: string) {
  const q = await question(db, id)
  await bankLock(db, q.subject_id)
  return question(db, id, true)
}
async function detail(db: Db, id: string) {
  const q = await question(db, id)
  const revision = (
    await db.query(
      "SELECT id,stem,explanation,payload->'visual' AS visual FROM question_revisions WHERE id=$1",
      [q.current_revision_id],
    )
  ).rows[0]
  const choices = (
    await db.query(
      'SELECT label,text,is_correct FROM question_choices WHERE revision_id=$1 ORDER BY label',
      [q.current_revision_id],
    )
  ).rows
  const topics = (
    await db.query(
      'SELECT t.code FROM question_topics qt JOIN topics t ON t.id=qt.topic_id WHERE qt.question_id=$1 ORDER BY t.sort_order,t.code',
      [id],
    )
  ).rows.map((row) => row.code as string)
  const sources = (
    await db.query(
      'SELECT s.id,s.title,qs.locator,s.review_status,s.license FROM question_sources qs JOIN sources s ON s.id=qs.source_id WHERE qs.revision_id=$1 ORDER BY s.id,qs.locator',
      [q.current_revision_id],
    )
  ).rows
  const assets = (
    await db.query(
      "SELECT a.id,'/api/v1/assets/'||a.id url,a.alt_text,a.mime FROM question_assets qa JOIN assets a ON a.id=qa.asset_id WHERE qa.revision_id=$1 ORDER BY a.id",
      [q.current_revision_id],
    )
  ).rows
  const accepted = (
    await db.query(
      'SELECT display FROM accepted_answers WHERE revision_id=$1 ORDER BY is_primary DESC,answer_normalized',
      [q.current_revision_id],
    )
  ).rows.map((row) => row.display as string)
  const history = (
    await db.query(
      'SELECT id,rev_no,stem,created_at,created_by FROM question_revisions WHERE question_id=$1 ORDER BY rev_no DESC',
      [id],
    )
  ).rows
  const reports = (
    await db.query(
      'SELECT id,question_id,revision_id,reason,note,status,resolved_by,resolution_note,created_at FROM question_reports WHERE question_id=$1 ORDER BY created_at DESC,id',
      [id],
    )
  ).rows
  return {
    id: q.id,
    subject: q.subject,
    type: q.type,
    status: q.status,
    version: q.version,
    revision: {
      ...revision,
      difficulty: q.difficulty,
      choices,
      topic_codes: topics,
      sources,
      assets,
      accepted_answers: accepted,
    },
    history,
    reports,
  }
}
export async function questionDetail(id: string, context?: Client) {
  return detail(context ?? getPool(), id)
}
export async function listQuestions(
  filters: {
    subject?: string
    topic?: string
    type?: string
    status?: string
    cursor?: string
    limit?: number
  } = {},
) {
  const values: unknown[] = [],
    where: string[] = []
  const add = (value: unknown, sql: (p: string) => string) => {
    values.push(value)
    where.push(sql(`$${values.length}`))
  }
  if (filters.subject) add(filters.subject, (p) => `s.code=${p}`)
  if (filters.status) add(filters.status, (p) => `q.status=${p}`)
  if (filters.type) add(filters.type, (p) => `q.type=${p}`)
  if (filters.topic)
    add(
      filters.topic,
      (p) =>
        `EXISTS(SELECT 1 FROM question_topics qt JOIN topics t ON t.id=qt.topic_id WHERE qt.question_id=q.id AND (t.id::text=${p} OR t.code=${p}))`,
    )
  if (filters.cursor) add(uuid.parse(filters.cursor), (p) => `q.id>${p}::uuid`)
  const limit = filters.limit ?? 25
  if (!Number.isInteger(limit) || limit < 1 || limit > 100)
    fail('validation_failed', 400, 'Giới hạn danh sách không hợp lệ')
  values.push(limit + 1)
  const rows = (
    await getPool().query(
      `SELECT q.id,s.code subject,q.type,q.status,q.version,r.stem FROM questions q JOIN subjects s ON s.id=q.subject_id LEFT JOIN question_revisions r ON r.id=q.current_revision_id ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY q.id LIMIT $${values.length}`,
      values,
    )
  ).rows
  return {
    items: rows.slice(0, limit),
    next_cursor: rows.length > limit ? (rows[limit - 1].id as string) : null,
  }
}
async function revisionInput(
  db: Db,
  q: QuestionRow,
  input: PatchQuestionRevision,
) {
  const visual = 'visual' in input ? input.visual : undefined
  if ((visual?.type ?? 'mcq') !== q.type)
    fail('validation_failed', 422, 'Loại câu hỏi phải giữ nguyên')
  if (visual?.type === 'name_from_structure') {
    const answers = input.accepted_answers ?? []
    if (new Set(answers.map(chemicalNameGradingKey)).size !== answers.length)
      fail('validation_failed', 422, 'Tên đáp án trùng sau khi chuẩn hóa')
  }
  const sourceIds = [...new Set(input.sources.map((s) => s.source_id))]
  const sources = (
    await db.query<{ id: string; title: string; fingerprint: string }>(
      'SELECT id,title,fingerprint FROM sources WHERE subject_id=$1 AND id=ANY($2::uuid[]) ORDER BY id FOR UPDATE',
      [q.subject_id, sourceIds],
    )
  ).rows
  if (sources.length !== sourceIds.length)
    fail('validation_failed', 422, 'Nguồn không thuộc môn học')
  const assets = (
    await db.query<{
      id: string
      sha256: string
      source_id: string | null
      kind: string
    }>(
      'SELECT id,sha256,source_id,kind FROM assets WHERE id=ANY($1::uuid[]) ORDER BY id',
      [input.asset_ids ?? []],
    )
  ).rows
  if (assets.length !== new Set(input.asset_ids ?? []).size)
    fail('validation_failed', 422, 'Tài sản không tồn tại')
  if (
    visual &&
    (assets.length !== 1 ||
      !assets[0]?.source_id ||
      !sourceIds.includes(assets[0].source_id) ||
      (visual.type === 'name_from_structure' && assets[0].kind !== 'svg'))
  )
    fail(
      'validation_failed',
      422,
      'Hình cần nguồn, giấy phép và định dạng phù hợp',
    )
  const topics = (
    await db.query<{ id: string; code: string }>(
      'SELECT id,code FROM topics WHERE subject_id=$1 AND code=ANY($2::text[]) ORDER BY code',
      [q.subject_id, input.topic_codes],
    )
  ).rows
  if (topics.length !== new Set(input.topic_codes).size)
    fail('validation_failed', 422, 'Chủ đề không thuộc môn học')
  const bySource = new Map(sources.map((s) => [s.id, s]))
  const contentHash = hash({
    type: q.type,
    difficulty: input.difficulty,
    stem: input.stem,
    explanation: input.explanation,
    choices:
      'choices' in input
        ? [...input.choices].sort((a, b) => a.label.localeCompare(b.label))
        : [],
    ...(visual ? { visual } : {}),
    topics: [...input.topic_codes].sort(),
    sources: input.sources
      .map((s) => ({
        fingerprint: bySource.get(s.source_id)!.fingerprint,
        locator: s.locator,
      }))
      .sort((a, b) => canonical(a).localeCompare(canonical(b))),
    assets: assets.map((a) => a.sha256).sort(),
    accepted_answers: (input.accepted_answers ?? [])
      .map(
        visual?.type === 'name_from_structure'
          ? normalizeChemicalName
          : normalized,
      )
      .sort(),
  })
  return { sources: bySource, topics, contentHash }
}
async function storeRevision(
  db: Db,
  q: QuestionRow,
  input: PatchQuestionRevision,
  actorId: string,
  prepared?: Awaited<ReturnType<typeof revisionInput>>,
) {
  const ready = prepared ?? (await revisionInput(db, q, input))
  const duplicate = (
    await db.query<{ question_id: string }>(
      'SELECT question_id FROM question_content_hashes WHERE subject_id=$1 AND content_hash=$2',
      [q.subject_id, ready.contentHash],
    )
  ).rows[0]
  let revisionHash = ready.contentHash
  if (duplicate) {
    if (duplicate.question_id !== q.id || q.type !== 'name_from_structure')
      fail('duplicate_content', 409, 'Nội dung đã có trong ngân hàng')
    const current = (
      await db.query<{
        base_hash: string
        primary_answer: string
        answers: string[]
      }>(
        `SELECT COALESCE(r.payload->>'base_content_hash',r.content_hash) AS base_hash,
                a.display AS primary_answer,
                ARRAY(SELECT k.display FROM accepted_answers k WHERE k.revision_id=r.id) AS answers
         FROM question_revisions r JOIN accepted_answers a ON a.revision_id=r.id AND a.is_primary
         WHERE r.id=$1 AND r.question_id=$2`,
        [q.current_revision_id, q.id],
      )
    ).rows[0]
    const answers = input.accepted_answers ?? []
    const primary = answers[0]
    const gradingKeys = [...new Set(answers.map(chemicalNameGradingKey))].sort()
    if (
      !primary ||
      current?.base_hash !== ready.contentHash ||
      (current.primary_answer === primary &&
        canonical(
          [...new Set(current.answers.map(chemicalNameGradingKey))].sort(),
        ) === canonical(gradingKeys))
    )
      fail('duplicate_content', 409, 'Nội dung đã có trong ngân hàng')
    // Keep legacy import deduplication and give grading changes their own revision.
    revisionHash = hash([
      ready.contentHash,
      q.current_revision_id,
      primary,
      gradingKeys,
    ])
  }
  const rid = randomUUID(),
    number = (
      await db.query<{ n: number }>(
        'SELECT COALESCE(max(rev_no),0)::int+1 n FROM question_revisions WHERE question_id=$1',
        [q.id],
      )
    ).rows[0]!.n
  const payload = {
    sources: input.sources.map((s) => ({
      title: ready.sources.get(s.source_id)!.title,
      locator: s.locator,
    })),
    asset_ids: input.asset_ids ?? [],
    ...('visual' in input ? { visual: input.visual } : {}),
    ...(duplicate ? { base_content_hash: ready.contentHash } : {}),
  }
  await db.query(
    'INSERT INTO question_revisions(id,question_id,rev_no,stem,payload,explanation,content_hash,created_by) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8)',
    [
      rid,
      q.id,
      number,
      input.stem,
      JSON.stringify(payload),
      input.explanation,
      revisionHash,
      actorId,
    ],
  )
  for (const choice of 'choices' in input ? input.choices : [])
    await db.query(
      'INSERT INTO question_choices(revision_id,label,text,is_correct) VALUES($1,$2,$3,$4)',
      [rid, choice.label, choice.text, choice.is_correct],
    )
  for (const s of input.sources)
    await db.query(
      'INSERT INTO question_sources(revision_id,source_id,locator) VALUES($1,$2,$3)',
      [rid, s.source_id, s.locator],
    )
  for (const asset of new Set(input.asset_ids ?? []))
    await db.query(
      'INSERT INTO question_assets(revision_id,asset_id) VALUES($1,$2)',
      [rid, asset],
    )
  const normalize =
    q.type === 'name_from_structure' ? chemicalNameGradingKey : normalized
  const unique = new Map<string, string>()
  for (const answer of input.accepted_answers ?? [])
    if (!unique.has(normalize(answer))) unique.set(normalize(answer), answer)
  for (const [index, [key, answer]] of [...unique].entries())
    await db.query(
      'INSERT INTO accepted_answers(revision_id,answer_normalized,display,is_primary) VALUES($1,$2,$3,$4)',
      [rid, key, answer, index === 0],
    )
  await db.query('DELETE FROM question_topics WHERE question_id=$1', [q.id])
  for (const topic of ready.topics)
    await db.query(
      'INSERT INTO question_topics(question_id,topic_id,subject_id) VALUES($1,$2,$3)',
      [q.id, topic.id, q.subject_id],
    )
  await db.query(
    'INSERT INTO question_content_hashes(subject_id,content_hash,question_id,revision_id) VALUES($1,$2,$3,$4)',
    [q.subject_id, revisionHash, q.id, rid],
  )
  await db.query(
    "UPDATE questions SET current_revision_id=$2,status='draft',difficulty=$3,version=version+1,updated_at=now() WHERE id=$1",
    [q.id, rid, input.difficulty],
  )
  return rid
}
export async function storeTaxonomy(
  db: Db,
  subjectId: string,
  topics: Bundle['topics'],
  options: { matchSortOrder?: boolean } = {},
) {
  if (new Set(topics.map((topic) => topic.code)).size !== topics.length)
    return fail('validation_failed', 422, 'Mã chủ đề bị trùng')
  const topicIds = new Map<string, string>(),
    pending = [...topics]
  while (pending.length) {
    let progress = false
    for (let index = pending.length - 1; index >= 0; index--) {
      const topic = pending[index]!
      if (topic.parent_code && !topicIds.has(topic.parent_code)) continue
      const existing = (
        await db.query<{
          id: string
          parent_id: string | null
          title: string
          sort_order: number
        }>(
          'SELECT id,parent_id,title,sort_order FROM topics WHERE subject_id=$1 AND code=$2',
          [subjectId, topic.code],
        )
      ).rows[0]
      const parent = topic.parent_code ? topicIds.get(topic.parent_code)! : null
      const sortOrder = topic.sort_order ?? 0
      if (existing) {
        if (existing.parent_id !== parent || existing.title !== topic.title)
          fail('topic_conflict', 409, 'Chủ đề hiện có khác nội dung bundle')
        if (options.matchSortOrder && existing.sort_order !== sortOrder)
          fail('topic_conflict', 409, 'Thứ tự chủ đề hiện có khác taxonomy')
        topicIds.set(topic.code, existing.id)
      } else {
        const id = randomUUID()
        await db.query(
          'INSERT INTO topics(id,subject_id,parent_id,code,title,sort_order) VALUES($1,$2,$3,$4,$5,$6)',
          [id, subjectId, parent, topic.code, topic.title, sortOrder],
        )
        topicIds.set(topic.code, id)
      }
      pending.splice(index, 1)
      progress = true
    }
    if (!progress) fail('validation_failed', 422, 'Cây chủ đề không hợp lệ')
  }
}
export async function importBundle(
  raw: unknown,
  actorId: string,
  requestId: string,
  context?: Client,
) {
  await admin(context ?? getPool(), actorId)
  const bundle = bundleSchema.parse(raw),
    bundleHash = hash(bundle)
  // Direct service callers must pass the same asset boundary as HTTP callers.
  const checkedAssets: {
    input: (typeof bundle.assets)[number]
    safe: Awaited<ReturnType<typeof validateAsset>>
  }[] = []
  for (const asset of bundle.assets)
    try {
      checkedAssets.push({ input: asset, safe: await validateAsset(asset) })
    } catch {
      fail('bundle_invalid', 422, 'Tài sản không hợp lệ')
    }
  return tx(async (db) => {
    await admin(db, actorId)
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `bundle:${bundleHash}`,
    ])
    const previous = (
      await db.query(
        'SELECT id,counts,report FROM imports WHERE bundle_hash=$1',
        [bundleHash],
      )
    ).rows[0]
    if (previous)
      return {
        import_id: previous.id as string,
        status: 'already_imported' as const,
        counts: previous.counts,
        report: previous.report,
      }
    await db.query(
      'INSERT INTO subjects(code,name) VALUES($1,$2) ON CONFLICT(code) DO NOTHING',
      [bundle.manifest.subject, bundle.manifest.label],
    )
    const subject = (
      await db.query<{ id: string }>('SELECT id FROM subjects WHERE code=$1', [
        bundle.manifest.subject,
      ])
    ).rows[0]!
    await bankLock(db, subject.id)
    const importId = randomUUID()
    await db.query(
      "INSERT INTO imports(id,uploaded_by,bundle_hash,status,counts,report) VALUES($1,$2,$3,'imported','{}','{}')",
      [importId, actorId, bundleHash],
    )
    await storeTaxonomy(db, subject.id, bundle.topics)
    const sourceIds = new Map<string, string>()
    for (const source of bundle.sources) {
      const fingerprint = hash({
        kind: source.kind,
        title: source.title,
        locator: source.locator,
        license: source.license,
      })
      await db.query(
        'INSERT INTO sources(subject_id,kind,title,locator,license,retrieved_at,fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(subject_id,fingerprint) DO NOTHING',
        [
          subject.id,
          source.kind,
          source.title,
          source.locator,
          source.license,
          source.retrieved_at,
          fingerprint,
        ],
      )
      const row = (
        await db.query<{ id: string }>(
          'SELECT id FROM sources WHERE subject_id=$1 AND fingerprint=$2',
          [subject.id, fingerprint],
        )
      ).rows[0]!
      sourceIds.set(source.ref, row.id)
    }
    const assetIds = new Map<string, string>()
    for (const { input, safe } of checkedAssets) {
      const prior = (
        await db.query(
          'SELECT id,license,attribution,alt_text,source_id FROM assets WHERE sha256=$1',
          [safe.sha256],
        )
      ).rows[0]
      const sourceId = input.source_ref
        ? sourceIds.get(input.source_ref)!
        : null
      if (prior) {
        if (
          prior.license !== input.license ||
          prior.attribution !== input.attribution ||
          prior.alt_text !== input.alt_text ||
          prior.source_id !== sourceId
        )
          fail(
            'asset_metadata_conflict',
            409,
            'Tài sản trùng dữ liệu nhưng khác quyền hoặc mô tả',
          )
        assetIds.set(input.ref, prior.id as string)
      } else {
        const id = randomUUID()
        await db.query(
          'INSERT INTO assets(id,kind,storage_key,mime,width,height,source_id,license,attribution,sha256,alt_text,data) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)',
          [
            id,
            input.kind,
            `db:${safe.sha256}`,
            safe.mime,
            safe.width,
            safe.height,
            sourceId,
            input.license,
            input.attribution,
            safe.sha256,
            input.alt_text,
            safe.data,
          ],
        )
        assetIds.set(input.ref, id)
      }
    }
    let created = 0,
      duplicates = 0
    const nearDuplicates: {
      external_id: string
      question_id: string
      similarity: number
    }[] = []
    for (const item of bundle.questions) {
      const input = patchQuestionRevisionSchema.parse({
        stem: item.stem,
        explanation: item.explanation,
        difficulty: item.difficulty,
        ...(item.type === 'mcq'
          ? { choices: item.choices }
          : { visual: item.visual }),
        topic_codes: item.topic_codes,
        accepted_answers: item.accepted_answers,
        sources: item.sources.map((s) => ({
          source_id: sourceIds.get(s.source_ref)!,
          locator: s.locator,
        })),
        asset_ids: (item.asset_refs ?? []).map((ref) => assetIds.get(ref)!),
      })
      const q = {
        id: randomUUID(),
        subject_id: subject.id,
        subject: bundle.manifest.subject,
        type: item.type,
        status: 'draft' as const,
        version: 0,
        difficulty: input.difficulty,
        current_revision_id: '',
      }
      const ready = await revisionInput(db, q, input)
      const duplicate = (
        await db.query<{ question_id: string }>(
          'SELECT question_id FROM question_content_hashes WHERE subject_id=$1 AND content_hash=$2',
          [subject.id, ready.contentHash],
        )
      ).rows[0]
      let questionId = duplicate?.question_id
      if (duplicate) duplicates++
      else {
        const near = (
          await db.query<{ id: string; similarity: number }>(
            'SELECT q.id,similarity(r.stem,$2)::float8 similarity FROM questions q JOIN question_revisions r ON r.id=q.current_revision_id WHERE q.subject_id=$1 AND similarity(r.stem,$2)>=0.6 ORDER BY similarity DESC,q.id LIMIT 5',
            [subject.id, input.stem],
          )
        ).rows
        nearDuplicates.push(
          ...near.map((row) => ({
            external_id: item.external_id,
            question_id: row.id,
            similarity: row.similarity,
          })),
        )
        await db.query(
          "INSERT INTO questions(id,subject_id,type,difficulty,status,import_id,version) VALUES($1,$2,$3,$4,'draft',$5,0)",
          [q.id, subject.id, item.type, input.difficulty, importId],
        )
        await storeRevision(db, q, input, actorId, ready)
        questionId = q.id
        created++
      }
      await db.query(
        'INSERT INTO import_questions(import_id,external_id,question_id) VALUES($1,$2,$3)',
        [importId, item.external_id, questionId],
      )
    }
    const counts = { created, duplicates },
      report = { near_duplicates: nearDuplicates }
    await db.query(
      'UPDATE imports SET counts=$2::jsonb,report=$3::jsonb WHERE id=$1',
      [importId, JSON.stringify(counts), JSON.stringify(report)],
    )
    await appendAudit(db, {
      actorId,
      action: 'content.imported',
      entityType: 'import',
      entityId: importId,
      requestId,
    })
    return { import_id: importId, status: 'imported' as const, counts, report }
  }, context)
}
export async function getImport(id: string) {
  const row = (
    await getPool().query(
      'SELECT id import_id,status,counts,report,created_at FROM imports WHERE id=$1',
      [id],
    )
  ).rows[0]
  if (!row) fail('not_found', 404, 'Không tìm thấy lần nhập')
  return row
}
export async function patchQuestion(
  id: string,
  patch: {
    expected_version: number
    status?: QuestionStatus
    revision?: PatchQuestionRevision
  },
  actorId: string,
  requestId: string,
  context?: Client,
) {
  return tx(async (db) => {
    await admin(db, actorId)
    const q = await lockedQuestion(db, id)
    if (q.version !== patch.expected_version)
      fail(
        'version_conflict',
        409,
        'Câu hỏi đã thay đổi. Hãy tải lại trước khi sửa.',
      )
    if (Boolean(patch.status) === Boolean(patch.revision))
      fail(
        'validation_failed',
        400,
        'Chỉ sửa nội dung hoặc đổi trạng thái trong một lần',
      )
    if (patch.revision)
      await storeRevision(
        db,
        q,
        patchQuestionRevisionSchema.parse(patch.revision),
        actorId,
      )
    else {
      const evidence = (
        await db.query<{ source_count: number; ready: boolean }>(
          'SELECT (SELECT count(*)::int FROM question_sources WHERE revision_id=$1) source_count,content_release_ready($1,$2) ready',
          [q.current_revision_id, q.subject_id],
        )
      ).rows[0]!
      try {
        assertTransition(q.status, patch.status!, {
          sourceCount: evidence.source_count,
          sourcesReady: evidence.ready,
          assetsReady: evidence.ready,
        })
      } catch {
        fail(
          'invalid_state_transition',
          422,
          'Chuyển trạng thái không hợp lệ hoặc thiếu nguồn đã duyệt',
        )
      }
      await db.query(
        'UPDATE questions SET status=$2,version=version+1,updated_at=now() WHERE id=$1',
        [id, patch.status],
      )
    }
    await appendAudit(db, {
      actorId,
      action: patch.revision ? 'content.revised' : 'content.transitioned',
      entityType: 'question',
      entityId: id,
      details: { status: patch.status ?? 'draft' },
      requestId,
    })
    return detail(db, id)
  }, context)
}
const sourceFields =
  'id,title,locator,review_status,license,audience,audience_rights_basis'

export async function listSources() {
  return {
    items: (
      await getPool().query(
        `SELECT ${sourceFields} FROM sources ORDER BY created_at DESC,id`,
      )
    ).rows,
  }
}
export async function approvePendingSources(
  ids: string[],
  actorId: string,
  requestId: string,
  context?: Client,
) {
  return tx(async (db) => {
    await admin(db, actorId)
    const { rows: subjects } = await db.query<{ subject_id: string }>(
      'SELECT DISTINCT subject_id FROM sources WHERE id=ANY($1::uuid[]) ORDER BY subject_id',
      [ids],
    )
    for (const { subject_id } of subjects) await bankLock(db, subject_id)
    const { rows } = await db.query<{ id: string }>(
      `UPDATE sources SET review_status='approved'
       WHERE id=ANY($1::uuid[]) AND review_status='pending' AND btrim(license)<>''
       RETURNING id`,
      [ids],
    )
    for (const { id } of rows) {
      await appendAudit(db, {
        actorId,
        action: 'source.reviewed',
        entityType: 'source',
        entityId: id,
        details: { status: 'approved' },
        requestId,
      })
    }
    return {
      approved_count: rows.length,
      skipped_count: new Set(ids).size - rows.length,
    }
  }, context)
}
export async function reviewSource(
  input: { id: string; review_status: 'approved' | 'rejected' | 'pending' },
  actorId: string,
  requestId: string,
  context?: Client,
) {
  return tx(async (db) => {
    await admin(db, actorId)
    const source = (
      await db.query('SELECT subject_id FROM sources WHERE id=$1', [input.id])
    ).rows[0]
    if (!source) fail('not_found', 404, 'Không tìm thấy nguồn')
    await bankLock(db, source.subject_id as string)
    const row = (
      await db.query(
        `UPDATE sources SET review_status=$2 WHERE id=$1 RETURNING ${sourceFields}`,
        [input.id, input.review_status],
      )
    ).rows[0]
    await appendAudit(db, {
      actorId,
      action: 'source.reviewed',
      entityType: 'source',
      entityId: input.id,
      details: { status: input.review_status },
      requestId,
    })
    return row
  }, context)
}
export async function changeSourceAudience(
  input: {
    id: string
    audience: Audience
    expected_audience: Audience
    rights_basis?: string
  },
  actorId: string,
  requestId: string,
  context?: Client,
) {
  return tx(async (db) => {
    await admin(db, actorId)
    const source = (
      await db.query<{ subject_id: string }>(
        'SELECT subject_id FROM sources WHERE id=$1',
        [input.id],
      )
    ).rows[0]
    if (!source) return fail('not_found', 404, 'Không tìm thấy nguồn')
    await bankLock(db, source.subject_id)
    const current = (
      await db.query<{
        audience: Audience
        license: string
        review_status: string
      }>(`SELECT ${sourceFields} FROM sources WHERE id=$1 FOR UPDATE`, [
        input.id,
      ])
    ).rows[0]
    if (!current) return fail('not_found', 404, 'Không tìm thấy nguồn')
    if (current.audience !== input.expected_audience)
      return fail(
        'version_conflict',
        409,
        'Phạm vi đã thay đổi. Hãy tải lại nguồn.',
      )
    if (current.audience === input.audience) return current
    const widening = canView(input.audience, current.audience) === false
    const basis = input.rights_basis?.trim()
    if (
      widening &&
      (current.review_status !== 'approved' ||
        !current.license.trim() ||
        !basis ||
        basis.length > 1000)
    )
      return fail(
        'rights_confirmation_required',
        422,
        'Cần duyệt nguồn và ghi căn cứ quyền chia sẻ cho phạm vi mới',
      )
    const saved = (
      await db.query(
        `UPDATE sources SET audience=$2,audience_rights_basis=$3 WHERE id=$1 RETURNING ${sourceFields}`,
        [input.id, input.audience, widening ? basis : null],
      )
    ).rows[0]
    await appendAudit(db, {
      actorId,
      requestId,
      action: 'source.audience_changed',
      entityType: 'source',
      entityId: input.id,
      details: {
        from_audience: current.audience,
        to_audience: input.audience,
        ...(widening && basis ? { rights_basis_sha256: hash(basis) } : {}),
      },
    })
    return saved
  }, context)
}

export async function listInvitations(actorId: string) {
  await admin(getPool(), actorId)
  return {
    items: (
      await getPool().query('SELECT * FROM list_class_invitations($1)', [
        actorId,
      ])
    ).rows,
  }
}

export async function setInvitation(
  input: { email: string; action: 'invite' | 'revoke' },
  actorId: string,
  requestId: string,
  context?: Client,
) {
  return tx(async (db) => {
    await admin(db, actorId)
    const email = input.email.trim().toLowerCase()
    const invite = input.action === 'invite'
    const { changed } = (
      await db.query<{ changed: boolean }>(
        'SELECT set_class_invitation($1,$2,$3) AS changed',
        [actorId, email, invite],
      )
    ).rows[0]!
    if (changed)
      await appendAudit(db, {
        actorId,
        requestId,
        action: invite ? 'class.invited' : 'class.revoked',
        entityType: 'class_invitation',
        entityId: hash(email),
      })
    return { changed }
  }, context)
}
export async function createReport(
  questionId: string,
  input: { reason: string; note?: string; revision_id?: string },
  actorId: string,
  requestId: string,
  context?: Client,
  allowAdmin = true,
) {
  return tx(async (db) => {
    const active = (
      await db.query("SELECT 1 FROM users WHERE id=$1 AND status='active'", [
        actorId,
      ])
    ).rows[0]
    if (!active) fail('forbidden', 403, 'Tài khoản không khả dụng')
    const q = await lockedQuestion(db, questionId)
    const seen = (
      await withAccountRows(
        actorId,
        (scoped) =>
          scoped.query(
            `SELECT i.question_revision_id FROM attempt_items i JOIN attempts a ON a.id=i.attempt_id
         JOIN question_revisions r ON r.id=i.question_revision_id
         WHERE a.user_id=$1 AND r.question_id=$2 AND ($3::uuid IS NULL OR i.question_revision_id=$3)
           AND can_view_revision(r.id,$4,(SELECT viewer_audience($1,$5)))
         ORDER BY a.started_at DESC LIMIT 1`,
            [
              actorId,
              questionId,
              input.revision_id ?? null,
              q.subject_id,
              allowAdmin,
            ],
          ),
        db,
      )
    ).rows[0]
    if (!seen)
      fail('forbidden', 403, 'Chỉ được báo lỗi câu đã gặp trong bài của bạn')
    const previous = (
      await db.query(
        "SELECT id,status,question_id,revision_id FROM question_reports WHERE reporter_id=$1 AND question_id=$2 AND status='open'",
        [actorId, questionId],
      )
    ).rows[0]
    if (previous) return previous
    const row = (
      await db.query(
        'INSERT INTO question_reports(question_id,revision_id,reporter_id,reason,note) VALUES($1,$2,$3,$4,$5) RETURNING id,status,question_id,revision_id',
        [
          questionId,
          seen.question_revision_id,
          actorId,
          input.reason,
          input.note ?? '',
        ],
      )
    ).rows[0]
    const status = statusAfterReport(q.status)
    if (status !== q.status)
      await db.query(
        'UPDATE questions SET status=$2,version=version+1,updated_at=now() WHERE id=$1',
        [questionId, status],
      )
    await appendAudit(db, {
      actorId,
      action: 'question.reported',
      entityType: 'question_report',
      entityId: row.id as string,
      details: { reason: input.reason, status: 'open' },
      requestId,
    })
    return row
  }, context)
}
export async function listReports(filters: { status?: string } = {}) {
  return {
    items: (
      await getPool().query(
        'SELECT id,question_id,revision_id,reason,note,status,created_at,resolved_by,resolution_note FROM question_reports WHERE ($1::text IS NULL OR status=$1) ORDER BY created_at DESC,id',
        [filters.status ?? null],
      )
    ).rows,
  }
}
export async function resolveReport(
  id: string,
  input: { status: 'accepted' | 'rejected' | 'resolved'; note?: string },
  actorId: string,
  requestId: string,
  context?: Client,
) {
  return tx(async (db) => {
    await admin(db, actorId)
    const lookup = (
      await db.query('SELECT question_id FROM question_reports WHERE id=$1', [
        id,
      ])
    ).rows[0]
    if (!lookup) fail('not_found', 404, 'Không tìm thấy báo lỗi')
    await lockedQuestion(db, lookup.question_id as string)
    const previous = (
      await db.query('SELECT * FROM question_reports WHERE id=$1 FOR UPDATE', [
        id,
      ])
    ).rows[0]!
    if (previous.status !== 'open') {
      if (previous.status === input.status) return previous
      fail('report_conflict', 409, 'Báo lỗi đã được xử lý')
    }
    const row = (
      await db.query(
        'UPDATE question_reports SET status=$2,resolved_by=$3,resolution_note=$4,resolved_at=now() WHERE id=$1 RETURNING id,question_id,status,resolution_note',
        [id, input.status, actorId, input.note ?? ''],
      )
    ).rows[0]
    await appendAudit(db, {
      actorId,
      action: 'report.resolved',
      entityType: 'question_report',
      entityId: id,
      details: { status: input.status },
      requestId,
    })
    return row
  }, context)
}
export async function getAsset(
  id: string,
  actor: { id: string; role: string; status: string },
  context?: Client,
) {
  if (actor.status !== 'active')
    fail('forbidden', 403, 'Tài khoản không khả dụng')
  const row = (
    await withAccountRows(
      actor.id,
      (db) =>
        db.query<{
          data: Buffer
          mime: string
          alt_text: string
          width: number
          height: number
        }>(
          `WITH viewer AS (SELECT viewer_audience($2,$3) AS tier)
       SELECT data,mime,alt_text,width,height FROM assets JOIN viewer ON true WHERE id=$1
         AND (viewer.tier=3 OR EXISTS(
           SELECT 1 FROM question_assets qa JOIN question_revisions r ON r.id=qa.revision_id
           JOIN questions q ON q.id=r.question_id WHERE qa.asset_id=$1
             AND can_view_revision(r.id,q.subject_id,viewer.tier)
             AND ((q.status='approved' AND q.current_revision_id=r.id) OR EXISTS(
               SELECT 1 FROM attempt_items i JOIN attempts a ON a.id=i.attempt_id
               WHERE i.question_revision_id=r.id AND a.user_id=$2
             ))
         ))`,
          [id, actor.id, actor.role === 'admin'],
        ),
      context,
    )
  ).rows[0]
  if (!row) fail('not_found', 404, 'Không tìm thấy tài sản')
  return row!
}
