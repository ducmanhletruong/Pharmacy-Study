import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  mkdir,
  readdir,
  realpath,
  rename,
  rmdir,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { isAbsolute, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bundleSchema, type Bundle } from '@pharmacy/api-contract/bundle'
import { importByteLimit } from '../../../api-contract/src/bundle/validate-cli'
import {
  closeMaintenance,
  getMaintenancePool,
  loadMaintenanceEnv,
} from '../../../db/src/maintenance'
import { sha256 } from '../bundle'

const require = createRequire(import.meta.url)
const { secureWindowsDirectory } =
  require('../../../../scripts/db-recovery-tools.mjs') as {
    secureWindowsDirectory: (path: string) => Promise<void>
  }
type Topic = Bundle['topics'][number]
type Source = Bundle['sources'][number]
type Asset = Bundle['assets'][number]
type Question = Bundle['questions'][number]
type QuestionData = {
  question: Question
  assets: Asset[]
  sources: Source[]
}

const questionPage = `
SELECT jsonb_build_object(
  'external_id', q.id, 'type', q.type, 'difficulty', q.difficulty,
  'stem', r.stem, 'explanation', r.explanation,
  'topic_codes', (SELECT coalesce(jsonb_agg(t.code ORDER BY t.code), '[]')
    FROM question_topics qt JOIN topics t ON t.id=qt.topic_id WHERE qt.question_id=q.id),
  'sources', (SELECT coalesce(jsonb_agg(jsonb_build_object('source_ref', source_id, 'locator', locator) ORDER BY source_id, locator), '[]')
    FROM question_sources WHERE revision_id=r.id),
  'asset_refs', (SELECT coalesce(jsonb_agg(asset_id ORDER BY asset_id), '[]')
    FROM question_assets WHERE revision_id=r.id),
  'accepted_answers', (SELECT coalesce(jsonb_agg(display ORDER BY is_primary DESC, answer_normalized), '[]')
    FROM accepted_answers WHERE revision_id=r.id)
) || CASE WHEN q.type='mcq' THEN jsonb_build_object('choices',
  (SELECT coalesce(jsonb_agg(jsonb_build_object('label',label,'text',text,'is_correct',is_correct) ORDER BY label),'[]')
   FROM question_choices WHERE revision_id=r.id))
 ELSE jsonb_build_object('visual',r.payload->'visual') END AS question,
(SELECT coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
  'ref', a.id, 'kind', a.kind, 'data_base64', replace(encode(a.data,'base64'),chr(10),''),
  'license', a.license, 'attribution', a.attribution, 'alt_text', a.alt_text, 'source_ref', a.source_id
)) ORDER BY a.id), '[]') FROM assets a JOIN question_assets qa ON qa.asset_id=a.id WHERE qa.revision_id=r.id) assets,
(SELECT coalesce(jsonb_agg(jsonb_build_object(
  'ref', s.id, 'kind', s.kind, 'title', s.title, 'locator', s.locator,
  'license', s.license, 'retrieved_at', s.retrieved_at
) ORDER BY s.id), '[]') FROM sources s
WHERE s.id IN (SELECT source_id FROM question_sources WHERE revision_id=r.id
  UNION SELECT a.source_id FROM assets a JOIN question_assets qa ON qa.asset_id=a.id WHERE qa.revision_id=r.id)) sources
FROM questions q JOIN question_revisions r ON r.id=q.current_revision_id
WHERE q.subject_id=$1 AND q.status='approved' AND ($2::uuid IS NULL OR q.id>$2)
ORDER BY q.id LIMIT 50`

function uniqueRefs<T extends { ref: string }>(values: T[]) {
  return [...new Map(values.map((value) => [value.ref, value])).values()]
}

function makeBundle(
  subject: string,
  topics: Map<string, Topic>,
  rows: QuestionData[],
  createdAt: string,
) {
  const included = new Map<string, Topic>()
  for (const { question } of rows) {
    for (const code of question.topic_codes) {
      let current: string | null = code
      while (current && !included.has(current)) {
        const topic: Topic | undefined = topics.get(current)
        if (!topic) throw new Error('Missing topic in approved data')
        included.set(current, topic)
        current = topic.parent_code
      }
    }
  }
  return {
    schema_version: 1 as const,
    manifest: {
      subject,
      label: 'Private approved bank export',
      generator: { name: 'approved-export', version: '1' },
      created_at: createdAt,
    },
    topics: [...included.values()],
    sources: uniqueRefs(rows.flatMap((row) => row.sources)),
    assets: uniqueRefs(rows.flatMap((row) => row.assets)),
    questions: rows.map((row) => row.question),
  }
}

async function run(parentArgument: string) {
  if (!parentArgument || !isAbsolute(parentArgument))
    throw new Error('Expected an absolute directory outside the repository')
  const parent = await realpath(parentArgument)
  const repo = await realpath(
    fileURLToPath(new URL('../../../../', import.meta.url)),
  )
  const fromRepo = relative(repo, parent)
  if (
    fromRepo !== '..' &&
    !fromRepo.startsWith('..' + sep) &&
    !isAbsolute(fromRepo)
  )
    throw new Error('Exports must stay outside the repository')
  loadMaintenanceEnv()
  const url = new URL(process.env.MIGRATION_DATABASE_URL ?? '')
  if (
    !['postgres:', 'postgresql:'].includes(url.protocol) ||
    url.hostname !== '127.0.0.1' ||
    url.search ||
    url.hash
  )
    throw new Error('A direct local migration connection is required')

  const maxBytes = importByteLimit(process.env.MAX_IMPORT_BYTES)
  const createdAt = new Date().toISOString()
  const name = 'approved-' + createdAt.slice(0, 10) + '-' + randomUUID()
  const staging = join(parent, '.' + name)
  const destination = join(parent, name)
  const files: { name: string; questions: number; sha256: string }[] = []
  const pool = getMaintenancePool()
  const client = await pool.connect()
  let outputReserved = false
  try {
    await client.query("SET TIME ZONE 'UTC'")
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const {
      rows: [role],
    } = await client.query(
      "SELECT pg_has_role(current_user, 'migrator', 'USAGE') AND NOT rolsuper AS allowed FROM pg_roles WHERE rolname=current_user",
    )
    if (!role?.allowed)
      throw new Error('A non-superuser migration role is required')
    await mkdir(staging, { mode: 0o700 })
    outputReserved = true
    await secureWindowsDirectory(staging)
    const subjects = await client.query<{ id: string; code: string }>(
      "SELECT s.id,s.code FROM subjects s WHERE EXISTS (SELECT 1 FROM questions q WHERE q.subject_id=s.id AND q.status='approved') ORDER BY s.code",
    )
    for (const { id, code } of subjects.rows) {
      const { rows: taxonomy } = await client.query<Topic>(
        'SELECT t.code,p.code parent_code,t.title,t.sort_order FROM topics t LEFT JOIN topics p ON p.id=t.parent_id WHERE t.subject_id=$1',
        [id],
      )
      const topics = new Map(taxonomy.map((topic) => [topic.code, topic]))
      const writePart = async (rows: QuestionData[]) => {
        const raw = makeBundle(code, topics, rows, createdAt)
        const json = JSON.stringify(raw) + '\n'
        if (
          raw.sources.length > 2000 ||
          raw.topics.length > 2000 ||
          raw.assets.length > 200 ||
          Buffer.byteLength(json) > maxBytes
        ) {
          if (rows.length === 1)
            throw new Error(
              'An approved question exceeds the limits of a P04 bundle',
            )
          const midpoint = Math.floor(rows.length / 2)
          await writePart(rows.slice(0, midpoint))
          await writePart(rows.slice(midpoint))
          return
        }
        bundleSchema.parse(raw)
        const name =
          'bundle-' + String(files.length + 1).padStart(4, '0') + '.json'
        await writeFile(join(staging, name), json, { flag: 'wx', mode: 0o600 })
        files.push({ name, questions: rows.length, sha256: sha256(json) })
      }
      let cursor: string | null = null
      while (true) {
        const { rows }: { rows: QuestionData[] } =
          await client.query<QuestionData>(questionPage, [id, cursor])
        if (!rows.length) break
        await writePart(rows)
        cursor = rows.at(-1)!.question.external_id
      }
    }
    await client.query('COMMIT')
    const counts = {
      bundles: files.length,
      questions: files.reduce((count, file) => count + file.questions, 0),
    }
    await writeFile(
      join(staging, 'manifest.json'),
      JSON.stringify({ createdAt, ...counts, files }, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    )
    await rename(staging, destination)
    outputReserved = false
    console.log(JSON.stringify({ directory: destination, ...counts }))
  } finally {
    await client.query('ROLLBACK').catch(() => {})
    client.release()
    if (outputReserved) {
      for (const name of await readdir(staging))
        await unlink(join(staging, name))
      await rmdir(staging)
    }
  }
}

try {
  if (process.argv.length !== 3) throw new Error('Invalid arguments')
  await run(process.argv[2]!)
} catch {
  console.error(
    'Approved bank export failed. Check the local maintenance connection, destination permissions and P04 bundle limits.',
  )
  process.exitCode = 1
} finally {
  await closeMaintenance()
}
