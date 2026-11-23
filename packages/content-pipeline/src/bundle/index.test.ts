import { describe, expect, test } from 'vitest'
import { readFileSync } from 'node:fs'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prepareBundle, sha256, writeBundle } from './index'
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../content/fixtures/p04-bundle.json', import.meta.url),
    'utf8',
  ),
)
const provenance = {
  provider: 'mock',
  model: 'synthetic-fixture',
  prompt_version: '1',
  prompt: 'Synthetic task only',
  sources: [{ ref: 'p04-source', text: 'Self-authored synthetic source' }],
}
describe('generated bundle provenance', () => {
  test('pins validated bundle, prompt and source bytes without embedding private text', () => {
    const result = prepareBundle(fixture, provenance)
    expect(result.provenance.bundle_sha256).toBe(sha256(result.json))
    expect(result.provenance.prompt_sha256).toBe(sha256(provenance.prompt))
    expect(JSON.stringify(result.provenance)).not.toContain(
      provenance.sources[0]!.text,
    )
    expect(
      prepareBundle(fixture, { ...provenance, prompt: 'changed' }).provenance
        .prompt_sha256,
    ).not.toBe(result.provenance.prompt_sha256)
    expect(() =>
      prepareBundle(fixture, { ...provenance, sources: [] }),
    ).toThrow('source provenance')
    expect(() =>
      prepareBundle({ ...fixture, schema_version: 99 }, provenance),
    ).toThrow()
  })
  test('writes importer-compatible JSON and refuses to overwrite a prior run', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pharmacy-pipeline-'))
    try {
      const path = join(root, 'run')
      const result = await writeBundle(path, fixture, provenance)
      const bytes = await readFile(join(path, 'bundle.json'), 'utf8')
      expect(sha256(bytes)).toBe(result.bundle_sha256)
      await expect(
        writeBundle(path, fixture, provenance),
      ).rejects.toMatchObject({ code: 'EEXIST' })
      expect(await readFile(join(path, 'bundle.json'), 'utf8')).toBe(bytes)
    } finally {
      if (!root.startsWith(join(tmpdir(), 'pharmacy-pipeline-')))
        throw Error('Unexpected fixture path')
      await rm(root, { recursive: true, force: true })
    }
  })
})
