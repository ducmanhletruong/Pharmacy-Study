import { expect, test } from 'vitest'
import {
  auditSample,
  chunkLedger,
  coverage,
  type ReviewedQuestion,
} from './index'

test('AC-2 checks 100 current revisions and rejects stale or duplicate review evidence', () => {
  const questions = Array.from({ length: 100 }, (_, index) => ({
    id: `q-${index}`,
    revision_id: `abcd0000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    subject: 'synthetic',
    type: 'mcq',
    status: 'approved' as const,
    topic_codes: [],
    chunk_ids: [],
  }))
  const decisions = questions.map(({ id, revision_id }, index) => ({
    id,
    revision_id,
    correct: index < 98,
  }))
  const audit = (records: typeof decisions) =>
    auditSample(questions, 'synthetic', 100, 'seed', records)

  expect(audit(decisions).review).toEqual({
    reviewed: 100,
    correct: 98,
    stale: 0,
    accuracy_pct: 98,
    target_pct: 98,
    meets_sample_target: true,
  })
  const uppercase = decisions.map((decision) => ({
    ...decision,
    revision_id: decision.revision_id.toUpperCase(),
  }))
  expect(audit(uppercase).review).toEqual(audit(decisions).review)
  expect(
    audit([{ ...decisions[0]!, correct: false }, ...decisions.slice(1)]).review,
  ).toMatchObject({ accuracy_pct: 97, meets_sample_target: false })
  expect(
    audit([
      { ...decisions[0]!, revision_id: decisions[1]!.revision_id },
      ...decisions.slice(1),
    ]).review,
  ).toMatchObject({ stale: 1, reviewed: 99, meets_sample_target: false })
  expect(() => audit([...decisions, decisions[0]!])).toThrow(/distinct/)
  expect(audit(decisions.slice(0, 99)).review?.meets_sample_target).toBe(false)
})

test('coverage includes empty topics and only counts approved revision evidence', () => {
  const source = {
    ref: 'one',
    title: 'One',
    locator: 'fixture',
    license: 'project-authored',
    text: '# A\nPrivate title\n\n# B\nSecond section',
  }
  const ledger = chunkLedger([source], { 'one:1': ['a', 'b'], 'one:2': ['b'] })
  expect(JSON.stringify(ledger)).not.toContain('Private title')
  const questions: ReviewedQuestion[] = [
    {
      id: 'q1',
      subject: 'demo',
      type: 'mcq',
      status: 'approved',
      topic_codes: ['a', 'b'],
      chunk_ids: [ledger[0]!.id],
    },
    {
      id: 'q2',
      subject: 'demo',
      type: 'mcq',
      status: 'draft',
      topic_codes: ['b'],
      chunk_ids: [ledger[1]!.id],
    },
  ]
  expect(
    coverage(ledger, questions, 'demo', ['a', 'b', 'c']).topics,
  ).toMatchObject([
    { topic: 'a', approved: 1, coverage_pct: 100 },
    { topic: 'b', approved: 1, coverage_pct: 50 },
    { topic: 'c', approved: 0, coverage_pct: null },
  ])
  expect(
    coverage(ledger, questions, 'demo', ['a', 'b', 'c']).taxonomy_coverage,
  ).toEqual({
    total_topics: 3,
    covered_topics: 2,
    coverage_pct: 66.67,
    target_pct: 90,
    meets_target: false,
  })
  expect(auditSample(questions, 'demo', 100, 'seed')).toMatchObject({
    requested: 100,
    available: 1,
    items: ['q1'],
  })
  const repeatedCitation = {
    ...questions[0]!,
    id: 'q3',
    type: 'synthetic',
    topic_codes: ['b', 'b'],
    chunk_ids: [ledger[0]!.id, ledger[0]!.id],
  }
  expect(
    coverage(ledger, [...questions, repeatedCitation], 'demo', ['b']).topics,
  ).toMatchObject([
    { approved: 2, by_type: { mcq: 1, synthetic: 1 }, covered_chunks: 1 },
  ])
  expect(() =>
    coverage([...ledger, ledger[0]!], questions, 'demo', ['b']),
  ).toThrow('Duplicate chunk ID')
})

test('the subject threshold counts distinct taxonomy topics with mapped and cited evidence', () => {
  const taxonomy = Array.from({ length: 10 }, (_, index) => `topic-${index}`)
  const covered = taxonomy.slice(0, 9)
  const ledger = chunkLedger(
    [
      {
        ref: 'source',
        title: 'Synthetic',
        locator: 'fixture',
        license: 'project-authored',
        text: '# Mapped\nSynthetic evidence\n# Unmapped\nOther evidence',
      },
    ],
    { 'source:1': covered },
  )
  const question: ReviewedQuestion = {
    id: 'q1',
    subject: 'demo',
    type: 'mcq',
    status: 'approved',
    topic_codes: taxonomy,
    chunk_ids: ledger.map(({ id }) => id),
  }
  expect(
    coverage(ledger, [question], 'demo', [...taxonomy, taxonomy[0]!])
      .taxonomy_coverage,
  ).toEqual({
    total_topics: 10,
    covered_topics: 9,
    coverage_pct: 90,
    target_pct: 90,
    meets_target: true,
  })
  expect(
    coverage(ledger, [question], 'another-subject', taxonomy).taxonomy_coverage
      .meets_target,
  ).toBe(false)
  expect(coverage(ledger, [], 'demo', []).taxonomy_coverage).toMatchObject({
    coverage_pct: null,
    meets_target: false,
  })
})

test('AC-1 accepts only chunks from sources cited by the approved revision', () => {
  const source = {
    ref: 'cited',
    kind: 'web' as const,
    title: 'Cited',
    locator: 'fixture',
    license: 'project-authored',
    text: 'identical fixture paragraph',
  }
  const [cited, unrelated] = chunkLedger(
    [source, { ...source, ref: 'other', title: 'Other' }],
    { 'cited:1': ['topic'], 'other:1': ['topic'] },
  )
  const { source_fingerprint, ...legacyChunk } = cited!
  const question = {
    id: 'q1',
    subject: 'demo',
    type: 'mcq',
    status: 'approved' as const,
    topic_codes: ['topic'],
    chunk_ids: [cited!.id],
  }
  const verified = { ...question, source_fingerprints: [source_fingerprint!] }
  expect(
    coverage([cited!, unrelated!], [verified], 'demo', ['topic'], true)
      .taxonomy_coverage.meets_target,
  ).toBe(true)
  expect(() =>
    coverage(
      [cited!, unrelated!],
      [{ ...verified, chunk_ids: [unrelated!.id] }],
      'demo',
      ['topic'],
      true,
    ),
  ).toThrow(/not from a source cited/)
  expect(() =>
    coverage([legacyChunk], [verified], 'demo', ['topic'], true),
  ).toThrow(/Regenerate/)
  expect(() => coverage([cited!], [question], 'demo', ['topic'], true)).toThrow(
    /Regenerate/,
  )
  expect(coverage([legacyChunk], [question], 'demo', ['topic']).approved).toBe(
    1,
  )
})

test('release coverage and audit samples exclude questions above the audience tier', () => {
  const source = {
    ref: 'fixture',
    title: 'Synthetic',
    locator: 'fixture',
    license: 'project-authored',
    text: '# Public\nEvidence\n# Class\nEvidence\n# Private\nEvidence',
  }
  const ledger = chunkLedger([source], {
    'fixture:1': ['public-topic'],
    'fixture:2': ['class-topic'],
    'fixture:3': ['private-topic'],
  })
  const taxonomy = ['public-topic', 'class-topic', 'private-topic']
  const questions: ReviewedQuestion[] = ([1, 2, 3] as const).map((tier, i) => ({
    id: 'question-' + tier,
    subject: 'demo',
    type: 'mcq',
    status: 'approved',
    topic_codes: [taxonomy[i]!],
    chunk_ids: [ledger[i]!.id],
    source_fingerprints: [ledger[i]!.source_fingerprint!],
    minimum_tier: tier,
  }))
  const scope = (audience: 'public' | 'class') =>
    coverage(ledger, questions, 'demo', taxonomy, true, audience)
  expect(scope('public')).toMatchObject({
    audience: 'public',
    approved: 1,
    taxonomy_coverage: { covered_topics: 1, meets_target: false },
  })
  expect(scope('class')).toMatchObject({
    audience: 'class',
    approved: 2,
    taxonomy_coverage: { covered_topics: 2, meets_target: false },
  })
  expect(
    auditSample(questions, 'demo', 100, 'seed', undefined, 'class'),
  ).toMatchObject({
    audience: 'class',
    available: 2,
    items: expect.arrayContaining(['question-1', 'question-2']),
  })
  expect(
    auditSample(questions, 'demo', 100, 'seed', undefined, 'public').items,
  ).toEqual(['question-1'])
  expect(coverage(ledger, questions, 'demo', taxonomy, true).approved).toBe(3)
  const { minimum_tier, ...legacy } = questions[0]!
  expect(minimum_tier).toBe(1)
  expect(() =>
    auditSample([legacy], 'demo', 100, 'seed', undefined, 'public'),
  ).toThrow(/Regenerate/)
})
