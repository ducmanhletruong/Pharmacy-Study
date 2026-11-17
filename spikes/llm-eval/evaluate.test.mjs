import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { evaluateCandidates } from './evaluate.mjs'

const fixtures = JSON.parse(
  await readFile(new URL('./fixtures.json', import.meta.url), 'utf8'),
)
const fixture = fixtures[0]
const valid = () => ({
  fixture_id: fixture.id,
  stem: 'Mẫu nào có thể tích 25 mL theo nguồn mô phỏng?',
  choices: [fixture.expected_answer, ...fixture.distractors].map((text, i) => ({
    key: 'ABCD'[i],
    text,
  })),
  correct_answer: 'A',
  explanation: 'Nguồn mô phỏng ghi PT-A có thể tích 25 mL.',
  citations: [
    {
      source_id: fixture.source_id,
      location: fixture.source_location,
      quote: fixture.source_text,
    },
  ],
})

test('accepts the expected source fact and exact citation', () => {
  assert.equal(evaluateCandidates([fixture], [valid()]).passed, true)
})

test('rejects a wrong answer, fabricated quote, duplicate options and duplicate outputs', () => {
  for (const mutate of [
    (candidate) => {
      candidate.correct_answer = 'B'
    },
    (candidate) => {
      candidate.citations[0].quote = 'Một câu không có trong nguồn'
    },
    (candidate) => {
      candidate.citations.push({
        source_id: 'fabricated',
        location: 'fake',
        quote: 'fake',
      })
    },
    (candidate) => {
      candidate.choices[1].text = candidate.choices[0].text
    },
    (candidate) => {
      candidate.choices[3].key = 'C'
    },
  ]) {
    const candidate = valid()
    mutate(candidate)
    assert.equal(evaluateCandidates([fixture], [candidate]).passed, false)
  }
  assert.equal(evaluateCandidates([fixture], [valid(), valid()]).passed, false)
  assert.equal(evaluateCandidates([fixture], []).passed, false)
})
