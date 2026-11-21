import { test, expect, afterAll } from 'vitest'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import {
  loadMaintenanceEnv,
  getMaintenancePool,
  closeMaintenance,
} from '../../packages/db/src/maintenance'
import { closeDb } from '../../packages/db/src/client'
import { importBundle } from '../../packages/db/src/content'
loadMaintenanceEnv()
afterAll(async () => {
  await closeDb()
  await closeMaintenance()
})
test('CLI mock output passes validator and imports only as draft with P04', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pharmacy-pipeline-integration-'))
  const c = await getMaintenancePool().connect()
  try {
    const b = JSON.parse(
      readFileSync(
        new URL('../../content/fixtures/p04-bundle.json', import.meta.url),
        'utf8',
      ),
    )
    const q = {
      ...b.questions[0],
      asset_refs: undefined,
      citations: [
        { source_ref: 'p04-source', quote: 'The fixture answer is 5.' },
      ],
    }
    await writeFile(
      join(root, 'sources.json'),
      JSON.stringify([
        {
          ref: 'p04-source',
          title: 'Self-authored fixture',
          locator: 'paragraph1',
          license: 'CC0-1.0',
          file: 'source.txt',
        },
      ]),
    )
    await writeFile(join(root, 'source.txt'), 'The fixture answer is 5.')
    await writeFile(join(root, 'mock.json'), JSON.stringify({ questions: [q] }))
    const tsx = createRequire(import.meta.url).resolve('tsx/cli')
    const out = join(root, 'output'),
      subject = 'p06-' + randomUUID()
    const result = spawnSync(
      process.execPath,
      [
        tsx,
        'packages/content-pipeline/src/cli/index.ts',
        '--sources',
        root,
        '--output',
        out,
        '--subject',
        subject,
        '--topic',
        'p04-addition',
        '--max-cost',
        '0',
        '--mock-output',
        join(root, 'mock.json'),
      ],
      { encoding: 'utf8', timeout: 15000 },
    )
    expect(result.status, result.stderr).toBe(0)
    const file = join(out, 'bundle', 'bundle.json')
    const valid = spawnSync(
      process.execPath,
      [tsx, 'packages/api-contract/src/bundle/validate-cli.ts', file],
      { encoding: 'utf8', timeout: 15000 },
    )
    expect(valid.status, valid.stderr).toBe(0)
    await c.query('BEGIN')
    const actor = randomUUID()
    await c.query(
      "INSERT INTO users(id,email,display_name,role) VALUES($1,$2,'Synthetic pipeline actor','admin')",
      [actor, actor + '@example.invalid'],
    )
    const imported = await importBundle(
      JSON.parse(await readFile(file, 'utf8')),
      actor,
      randomUUID(),
      c,
    )
    expect(imported.import_id).toBeTruthy()
    const states = await c.query(
      'SELECT q.status FROM import_questions i JOIN questions q ON q.id=i.question_id WHERE i.import_id=$1',
      [imported.import_id],
    )
    expect(states.rows.map((r) => r.status)).toEqual(['draft'])
  } finally {
    await c.query('ROLLBACK')
    c.release()
    if (!root.startsWith(join(tmpdir(), 'pharmacy-pipeline-integration-')))
      throw Error('Unexpected fixture path')
    await rm(root, { recursive: true, force: true })
  }
}, 40000)
