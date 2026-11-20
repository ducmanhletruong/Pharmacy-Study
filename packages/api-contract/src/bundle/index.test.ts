import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'
import { bundleSchema, patchQuestionRevisionSchema } from './index'
const fixture = JSON.parse(
  await readFile(
    new URL('../../../../content/fixtures/p04-bundle.json', import.meta.url),
    'utf8',
  ),
)
const copy = () => structuredClone(fixture)

test('accepts the synthetic JSON profile and normalizes text but not identity', () => {
  const input = copy()
  input.questions[0].stem = '  A\u0301p dụng ví dụ tổng hợp  '
  const parsed = bundleSchema.parse(input)
  expect(parsed.questions[0]!.stem).toBe(
    input.questions[0].stem.trim().normalize('NFC'),
  )
  expect(parsed.topics[0]!.sort_order).toBe(0)
  expect(parsed.manifest.subject).toBe('synthetic')
})
test('rejects unknown fields and attempts to import approved question/source states', () => {
  for (const mutate of [
    (v: typeof fixture) => {
      v.extra = true
    },
    (v: typeof fixture) => {
      v.questions[0].status = 'approved'
    },
    (v: typeof fixture) => {
      v.sources[0].review_status = 'approved'
    },
    (v: typeof fixture) => {
      v.manifest.generator.api_key = 'private'
    },
  ]) {
    const input = copy()
    mutate(input)
    expect(bundleSchema.safeParse(input).success).toBe(false)
  }
})
test('rejects duplicate IDs, missing references, self-cycles and multi-topic cycles', () => {
  for (const mutate of [
    (v: typeof fixture) => {
      v.questions.push(structuredClone(v.questions[0]))
    },
    (v: typeof fixture) => {
      v.topics.push(structuredClone(v.topics[0]))
    },
    (v: typeof fixture) => {
      v.sources.push(structuredClone(v.sources[0]))
    },
    (v: typeof fixture) => {
      v.assets.push(structuredClone(v.assets[0]))
    },
    (v: typeof fixture) => {
      v.questions[0].topic_codes = ['missing']
    },
    (v: typeof fixture) => {
      v.questions[0].sources[0].source_ref = 'missing'
    },
    (v: typeof fixture) => {
      v.questions[0].asset_refs = ['missing']
    },
    (v: typeof fixture) => {
      v.assets[0].source_ref = 'missing'
    },
    (v: typeof fixture) => {
      v.topics[0].parent_code = 'missing'
    },
    (v: typeof fixture) => {
      v.topics[0].parent_code = v.topics[0].code
    },
    (v: typeof fixture) => {
      v.topics[0].parent_code = v.topics[1].code
    },
    (v: typeof fixture) => {
      v.questions[0].topic_codes.push(v.questions[0].topic_codes[0])
    },
  ]) {
    const input = copy()
    mutate(input)
    expect(bundleSchema.safeParse(input).success).toBe(false)
  }
})
test('enforces MCQ labels, exactly one correct choice and Unicode-aware distinct text', () => {
  for (const mutate of [
    (v: typeof fixture) => {
      v.questions[0].choices.pop()
    },
    (v: typeof fixture) => {
      v.questions[0].choices[0].label = 'B'
    },
    (v: typeof fixture) => {
      v.questions[0].choices.forEach(
        (c: { is_correct: boolean }) => (c.is_correct = false),
      )
    },
    (v: typeof fixture) => {
      v.questions[0].choices[0].is_correct = true
    },
    (v: typeof fixture) => {
      v.questions[0].choices[0].text = ' É '
      v.questions[0].choices[1].text = 'e\u0301'
    },
    (v: typeof fixture) => {
      v.questions[0].choices[0].text = '  '
    },
    (v: typeof fixture) => {
      v.questions[0].type = 'calc'
    },
  ]) {
    const input = copy()
    mutate(input)
    expect(bundleSchema.safeParse(input).success).toBe(false)
  }
})
test('rejects malformed identity/license/base64 while allowing draft questions without sources', () => {
  for (const mutate of [
    (v: typeof fixture) => {
      v.questions[0].external_id = '../escape'
    },
    (v: typeof fixture) => {
      v.questions = []
    },
    (v: typeof fixture) => {
      v.assets[0].license = ''
    },
    (v: typeof fixture) => {
      v.sources[0].license = ' '
    },
    (v: typeof fixture) => {
      v.assets[0].data_base64 = 'data:image/svg+xml;base64,AAAA'
    },
    (v: typeof fixture) => {
      v.assets[0].data_base64 = 'AAAA\nAAAA'
    },
    (v: typeof fixture) => {
      v.assets[0].data_base64 = 'AA==='
    },
    (v: typeof fixture) => {
      v.manifest.created_at = 'yesterday'
    },
  ]) {
    const input = copy()
    mutate(input)
    expect(bundleSchema.safeParse(input).success).toBe(false)
  }
  const input = copy()
  input.questions[0].sources = []
  expect(bundleSchema.safeParse(input).success).toBe(true)
})
test('revision patch uses existing UUID links and refuses status or alias confusion', () => {
  const q = copy().questions[0]
  const revision = {
    stem: q.stem,
    explanation: q.explanation,
    difficulty: q.difficulty,
    choices: q.choices,
    topic_codes: q.topic_codes,
    sources: [
      {
        source_id: '00000000-0000-4000-8000-000000000001',
        locator: 'Synthetic paragraph',
      },
    ],
    asset_ids: [],
  }
  expect(patchQuestionRevisionSchema.safeParse(revision).success).toBe(true)
  expect(
    patchQuestionRevisionSchema.safeParse({ ...revision, status: 'approved' })
      .success,
  ).toBe(false)
  expect(
    patchQuestionRevisionSchema.safeParse({ ...revision, sources: q.sources })
      .success,
  ).toBe(false)
  expect(
    patchQuestionRevisionSchema.safeParse({
      ...revision,
      sources: [...revision.sources, ...revision.sources],
    }).success,
  ).toBe(false)
})
