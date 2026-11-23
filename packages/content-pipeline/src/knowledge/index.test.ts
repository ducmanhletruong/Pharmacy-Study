import { test, expect } from 'vitest'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { LocalKnowledgeSource, validateSources } from './index'
test('manual knowledge reads licensed text only inside root and rejects traversal', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pharmacy-knowledge-'))
  const item = {
    ref: 'synthetic',
    title: 'Synthetic',
    locator: 'paragraph1',
    license: 'CC0-1.0',
    file: 'source.txt',
  }
  try {
    await writeFile(join(root, 'source.txt'), 'Self-authored fixture')
    await writeFile(join(root, 'sources.json'), JSON.stringify([item]))
    expect((await new LocalKnowledgeSource(root).read())[0]!.text).toBe(
      'Self-authored fixture',
    )
    await writeFile(
      join(root, 'sources.json'),
      JSON.stringify([{ ...item, file: '../outside.txt' }]),
    )
    await expect(new LocalKnowledgeSource(root).read()).rejects.toThrow()
    expect(() =>
      validateSources([
        { ...item, text: 'x' },
        { ...item, text: 'y' },
      ]),
    ).toThrow('duplicate')
    expect(() =>
      validateSources([{ ...item, text: 'x', license: '' }]),
    ).toThrow('license')
  } finally {
    if (!root.startsWith(join(tmpdir(), 'pharmacy-knowledge-')))
      throw Error('Unexpected fixture path')
    await rm(root, { recursive: true, force: true })
  }
})
