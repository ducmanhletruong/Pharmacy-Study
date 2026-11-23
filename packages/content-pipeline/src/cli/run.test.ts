import { test, expect, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { run } from './run'
import { bundleSchema } from '@pharmacy/api-contract/bundle'
test('dry run never invokes inference; budget denial occurs before reading sources', async () => {
  const read = vi.fn(async () => [
    {
      ref: 'fixture',
      title: 'Synthetic',
      locator: 'p1',
      license: 'CC0',
      text: 'Synthetic',
    },
  ])
  const generate = vi.fn(async () => ({
    questions: [],
    input_tokens: 0,
    output_tokens: 0,
  }))
  const options = {
    subject: 'synthetic',
    topic: 'fixture',
    output: 'unused',
    dry_run: true,
    max_cost: 0,
    estimated_max_cost: 0,
  }
  await expect(
    run(options, { read }, { name: 'mock', model: 'fixture', generate }),
  ).resolves.toMatchObject({ dry_run: true, actual_cost: 0 })
  expect(generate).not.toHaveBeenCalled()
  read.mockClear()
  await expect(
    run(
      { ...options, estimated_max_cost: 1 },
      { read },
      { name: 'mock', model: 'fixture', generate },
    ),
  ).rejects.toThrow('max-cost')
  expect(read).not.toHaveBeenCalled()
  await expect(
    run(
      { ...options, dry_run: false },
      { read },
      { name: 'openai', model: 'unapproved', generate },
    ),
  ).rejects.toThrow('authorization')
  expect(generate).not.toHaveBeenCalled()
  expect(read).not.toHaveBeenCalled()
})
test('mock generation writes a P04-valid bundle with citations and cost ledger', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pharmacy-cli-'))
  try {
    const fixture = JSON.parse(
      readFileSync(
        new URL(
          '../../../../content/fixtures/p04-bundle.json',
          import.meta.url,
        ),
        'utf8',
      ),
    )
    const question = {
      ...fixture.questions[0],
      asset_refs: undefined,
      citations: [
        { source_ref: 'p04-source', quote: 'The fixture answer is 5.' },
      ],
    }
    const provider = {
      name: 'mock',
      model: 'fixture',
      generate: async () => ({
        questions: [question],
        input_tokens: 10,
        output_tokens: 20,
      }),
    }
    const knowledge = {
      read: async () => [
        {
          ref: 'p04-source',
          title: 'Synthetic',
          locator: 'p1',
          license: 'CC0',
          text: 'The fixture answer is 5.',
        },
      ],
    }
    const output = join(root, 'run')
    const result = await run(
      {
        subject: 'synthetic',
        topic: 'p04-addition',
        output,
        dry_run: false,
        max_cost: 0,
        estimated_max_cost: 0,
      },
      knowledge,
      provider,
    )
    expect(result).toMatchObject({ accepted: 1, actual_cost: 0 })
    expect(
      bundleSchema.parse(
        JSON.parse(
          await readFile(join(output, 'bundle', 'bundle.json'), 'utf8'),
        ),
      ).questions,
    ).toHaveLength(1)
    expect(
      JSON.parse(await readFile(join(output, 'cost.json'), 'utf8')).status,
    ).toBe('completed')
  } finally {
    if (!root.startsWith(join(tmpdir(), 'pharmacy-cli-')))
      throw Error('Unexpected fixture path')
    await rm(root, { recursive: true, force: true })
  }
})
