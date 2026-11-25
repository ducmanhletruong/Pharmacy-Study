import { parseArgs } from 'node:util'
import { readTaxonomyFile } from '../packages/content-pipeline/src/taxonomy-file'
import { bundleSchema } from '../packages/api-contract/src/bundle'
import { storeTaxonomy } from '../packages/db/src/content'
import {
  closeMaintenance,
  getMaintenancePool,
} from '../packages/db/src/maintenance'

try {
  const { values } = parseArgs({
    options: {
      subject: { type: 'string' },
      file: { type: 'string' },
      apply: { type: 'boolean', default: false },
    },
  })
  if (
    !values.file ||
    !values.subject ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(values.subject)
  )
    throw Error('Provide a subject and local taxonomy file')
  if (!process.env.MIGRATION_DATABASE_URL)
    throw Error('An explicit maintenance connection is required')
  const topics = bundleSchema.shape.topics.parse(
    await readTaxonomyFile(values.file),
  )
  const db = await getMaintenancePool().connect()
  try {
    await db.query('BEGIN')
    const subject = (
      await db.query<{ id: string }>('SELECT id FROM subjects WHERE code=$1', [
        values.subject,
      ])
    ).rows[0]
    if (!subject) throw Error('Subject is not registered')
    await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `content:${subject.id}`,
    ])
    const count = async () =>
      (
        await db.query<{ count: number }>(
          'SELECT count(*)::int AS count FROM topics WHERE subject_id=$1',
          [subject.id],
        )
      ).rows[0]!.count
    const before = await count()
    await storeTaxonomy(db, subject.id, topics, { matchSortOrder: true })
    const inserted = (await count()) - before
    await db.query(values.apply ? 'COMMIT' : 'ROLLBACK')
    console.log(
      JSON.stringify({
        mode: values.apply ? 'apply' : 'dry-run',
        topics: topics.length,
        inserted,
        existing: topics.length - inserted,
      }),
    )
  } catch (error) {
    await db.query('ROLLBACK')
    throw error
  } finally {
    db.release()
  }
} catch {
  console.error(
    'Taxonomy import failed. Check the file, subject, existing topic tree and database rights.',
  )
  process.exitCode = 1
} finally {
  await closeMaintenance()
}
