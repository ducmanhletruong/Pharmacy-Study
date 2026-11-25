import { test, expect, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { run } from './run'
import { bundleSchema } from '@pharmacy/api-contract/bundle'
import { paidModel } from '../llm/budget'
import { OpenAiOutputError, OpenAiProvider } from '../llm/openai'
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
        questions: [
          question,
          null,
          { ...question, asset_refs: ['missing-fixture-asset'] },
          { ...question, sources: [...question.sources, ...question.sources] },
          ...['A', 'B', 'C'].map((suffix) => ({
            ...question,
            external_id: `${question.external_id}-${suffix}`,
            stem: `${question.stem} Trường hợp ${suffix}.`,
            topic_codes: ['p04-addition', 'extra-fixture-topic'],
          })),
        ],
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
    expect(result).toMatchObject({
      accepted: 4,
      rejected: 3,
      actual_cost: 0,
      provider: 'mock',
      model: provider.model,
      started_at: expect.stringMatching(/Z$/),
    })
    expect(
      JSON.parse(await readFile(join(output, 'rejections.json'), 'utf8')),
    ).toEqual([
      { index: 2, reason: 'invalid_question' },
      { index: 3, reason: 'invalid_question' },
      { index: 4, reason: 'invalid_question' },
    ])
    expect(
      bundleSchema.parse(
        JSON.parse(
          await readFile(join(output, 'bundle', 'bundle.json'), 'utf8'),
        ),
      ).questions,
    ).toHaveLength(4)
    expect(
      JSON.parse(await readFile(join(output, 'cost.json'), 'utf8')).status,
    ).toBe('completed')
  } finally {
    if (!root.startsWith(join(tmpdir(), 'pharmacy-cli-')))
      throw Error('Unexpected fixture path')
    await rm(root, { recursive: true, force: true })
  }
})

test.each(['missing-parent', 'fixture'])(
  'invalid taxonomy parent %s blocks a paid run before reading sources or calling the provider',
  async (parent_code) => {
    const read = vi.fn()
    const generate = vi.fn()
    await expect(
      run(
        {
          subject: 'synthetic',
          topic: 'fixture',
          output: 'unused',
          dry_run: false,
          max_cost: 0.5,
          estimated_max_cost: 0,
          paid: { ledgerDir: 'unused' },
          taxonomy: [{ code: 'fixture', title: 'Synthetic', parent_code }],
        },
        { read },
        { name: 'openai', model: paidModel, generate },
      ),
    ).rejects.toThrow(/Parent topic|Topic graph/)
    expect(read).not.toHaveBeenCalled()
    expect(generate).not.toHaveBeenCalled()
  },
)

test('paid run logs reservation denial separately from invalid output with metered usage', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pharmacy-cli-'))
  try {
    const knowledge = { read: async () => [] }
    const usageError = new OpenAiOutputError(
      12,
      34,
      'req_0123456789abcdef0123456789abcdef',
    )
    const provider = {
      name: 'openai',
      model: paidModel,
      generate: vi.fn().mockRejectedValue(usageError),
    }
    const options = {
      subject: 'synthetic',
      topic: 'fixture',
      dry_run: false,
      max_cost: 0.5,
      estimated_max_cost: 0,
    }
    const result = (name: string) =>
      JSON.parse(readFileSync(join(root, name, 'cost.json'), 'utf8'))

    await expect(
      run(
        {
          ...options,
          output: join(root, 'denied'),
          paid: { ledgerDir: join(root, 'missing-ledger') },
        },
        knowledge,
        provider,
      ),
    ).rejects.toThrow()
    expect(provider.generate).not.toHaveBeenCalled()
    expect(result('denied')).toMatchObject({
      status: 'blocked_before_inference',
      actual_cost: 0,
    })

    await expect(
      run(
        {
          ...options,
          output: join(root, 'metered'),
          paid: { ledgerDir: root },
        },
        knowledge,
        provider,
      ),
    ).rejects.toBe(usageError)
    expect(provider.generate).toHaveBeenCalledTimes(1)
    expect(result('metered')).toMatchObject({
      status: 'failed_usage_known',
      input_tokens: 12,
      output_tokens: 34,
      actual_cost: 0.000364,
      provider_request_id: 'req_0123456789abcdef0123456789abcdef',
    })
    provider.generate.mockResolvedValueOnce({
      questions: [],
      input_tokens: 20,
      output_tokens: 40,
      provider_request_id: 'req_1123456789abcdef0123456789abcdef',
    })
    await expect(
      run(
        {
          ...options,
          output: join(root, 'wrong-size'),
          paid: { ledgerDir: root },
        },
        knowledge,
        provider,
      ),
    ).rejects.toThrow('Unexpected paid pilot batch size')
    expect(result('wrong-size')).toMatchObject({
      status: 'failed_usage_known',
      input_tokens: 20,
      output_tokens: 40,
      provider_request_id: 'req_1123456789abcdef0123456789abcdef',
      actual_cost: 0.00044,
    })
    const networkError = new Error('synthetic transport failure')
    provider.generate.mockRejectedValueOnce(networkError)
    await expect(
      run(
        {
          ...options,
          output: join(root, 'unconfirmed'),
          paid: { ledgerDir: root },
        },
        knowledge,
        provider,
      ),
    ).rejects.toBe(networkError)
    const unconfirmed = result('unconfirmed')
    expect(unconfirmed).toMatchObject({
      status: 'failed_usage_unknown',
      actual_cost: null,
      provider: 'openai',
      model: paidModel,
      started_at: expect.stringMatching(/Z$/),
      client_request_id: expect.stringMatching(/^[a-f0-9-]{36}$/),
    })
    expect(unconfirmed.client_request_id).toBe(
      provider.generate.mock.lastCall?.[3],
    )
    expect(JSON.stringify(unconfirmed)).not.toContain(networkError.message)

    const transport = vi.fn(async () =>
      Response.json(
        {
          error: {
            code: 'unsupported_parameter',
            param: 'text.format.type',
            message: 'Synthetic secret-bearing error detail',
          },
        },
        {
          status: 400,
          headers: { 'x-request-id': 'req_0123456789abcdef0123456789abcdef' },
        },
      ),
    )
    const rejectedProvider = new OpenAiProvider(
      {
        api_key: 'synthetic-only',
        model: paidModel,
        max_output_tokens: 4096,
        billing_approved: true,
      },
      transport,
    )
    await expect(
      run(
        {
          ...options,
          output: join(root, 'request-rejected'),
          paid: { ledgerDir: root },
        },
        knowledge,
        rejectedProvider,
      ),
    ).rejects.toThrow('OpenAI request failed')
    expect(transport).toHaveBeenCalledTimes(1)
    const rejected = result('request-rejected')
    expect(rejected).toMatchObject({
      status: 'failed_usage_unknown',
      actual_cost: null,
      provider_http_status: 400,
      provider_request_id: 'req_0123456789abcdef0123456789abcdef',
      provider_error_code: 'unsupported_parameter',
      provider_error_param: 'text.format.type',
    })
    expect(JSON.stringify(rejected)).not.toContain('secret-bearing')
  } finally {
    if (!root.startsWith(join(tmpdir(), 'pharmacy-cli-')))
      throw Error('Unexpected fixture path')
    await rm(root, { recursive: true, force: true })
  }
})
