import { readFile, stat } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { revisionChunkMapping } from '../packages/api-contract/src/content-report'
import { sourceFingerprint } from '../packages/content-pipeline/src/chunks'
import {
  closeMaintenance,
  getMaintenancePool,
} from '../packages/db/src/maintenance'

const subjectNotRegistered = new Error('Subject is not registered.')

try {
  const { values } = parseArgs({
    options: { subject: { type: 'string' }, mapping: { type: 'string' } },
  })
  if (
    !values.subject ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(values.subject)
  )
    throw Error('A subject code is required')
  if (!process.env.MIGRATION_DATABASE_URL)
    throw Error('An explicit maintenance database connection is required')
  const mapping = new Map<string, string[]>()
  if (values.mapping) {
    const info = await stat(values.mapping)
    if (!info.isFile() || info.size > 16 * 1024 * 1024)
      throw Error('Invalid mapping file')
    const entries = revisionChunkMapping.parse(
      JSON.parse(await readFile(values.mapping, 'utf8')),
    )
    for (const [revisionId, chunkIds] of Object.entries(entries)) {
      const key = revisionId.toLowerCase()
      if (mapping.has(key)) throw Error('Duplicate revision UUID in mapping')
      mapping.set(key, chunkIds)
    }
  }
  const client = await getMaintenancePool().connect()
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY')
    const { rowCount } = await client.query(
      'SELECT 1 FROM subjects WHERE code=$1',
      [values.subject],
    )
    if (!rowCount) throw subjectNotRegistered
    const { rows } = await client.query<{
      id: string
      revision_id: string
      subject: string
      type: string
      status: 'approved'
      topic_codes: string[]
      minimum_tier: 1 | 2 | 3 | null
      source_metadata: Parameters<typeof sourceFingerprint>[0][]
    }>(
      `SELECT q.id,q.current_revision_id revision_id,s.code subject,q.type,q.status,access.minimum_tier,
       ARRAY(SELECT t.code FROM question_topics qt JOIN topics t ON t.id=qt.topic_id WHERE qt.question_id=q.id ORDER BY t.code) AS topic_codes,
       COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',src.kind,'title',src.title,'locator',src.locator,'license',src.license))
        FROM question_sources qs JOIN sources src ON src.id=qs.source_id
        WHERE qs.revision_id=q.current_revision_id AND src.subject_id=q.subject_id),'[]'::jsonb) AS source_metadata
       FROM questions q JOIN subjects s ON s.id=q.subject_id
       LEFT JOIN released_revision_audiences access
        ON access.revision_id=q.current_revision_id AND access.subject_id=q.subject_id
       WHERE s.code=$1 AND q.status='approved' AND content_release_ready(q.current_revision_id,q.subject_id)
       ORDER BY q.id`,
      [values.subject],
    )
    await client.query('COMMIT')
    const index = rows.map(({ revision_id, source_metadata, ...q }) => {
      const chunk_ids = mapping.get(revision_id) ?? []
      mapping.delete(revision_id)
      const source_fingerprints = [
        ...new Set(source_metadata.map(sourceFingerprint)),
      ].sort()
      return { ...q, revision_id, chunk_ids, source_fingerprints }
    })
    if (mapping.size)
      console.error(
        `Ignored ${mapping.size} mapping entries outside the current approved revisions for this subject.`,
      )
    console.log(JSON.stringify(index, null, 2))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
} catch (error) {
  console.error(
    error === subjectNotRegistered
      ? 'Review index failed. Subject is not registered.'
      : 'Review index failed. Check the explicit local database, subject and revision mapping.',
  )
  process.exitCode = 1
} finally {
  await closeMaintenance()
}
