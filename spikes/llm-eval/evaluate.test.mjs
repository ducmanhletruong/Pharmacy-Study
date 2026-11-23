import assert from 'node:assert/strict'
import { copyFile, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
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

test('rejects empty, duplicate and malformed fixture identities before evaluating', () => {
  for (const invalid of [
    [],
    null,
    {},
    [null],
    [[]],
    [fixture, structuredClone(fixture)],
    [{ ...fixture, id: '' }],
    [{ ...fixture, id: ' duplicate id ' }],
    [{ ...fixture, id: 12 }],
    [{ ...fixture, source_id: 'bad source' }],
  ])
    assert.throws(() => evaluateCandidates(invalid, []), /Fixture|fixture/)
})

test('rejects malformed fixture facts and choices instead of reporting a misleading pass', () => {
  const invalid = []
  for (const field of [
    'subject',
    'source_location',
    'source_text',
    'task',
    'expected_answer',
  ]) {
    invalid.push({ ...fixture, [field]: '' }, { ...fixture, [field]: null })
  }
  invalid.push(
    { ...fixture, distractors: [] },
    { ...fixture, distractors: ['one', 'two', ''] },
    { ...fixture, distractors: [fixture.expected_answer, 'two', 'three'] },
    { ...fixture, distractors: ['one', ' ONE ', 'three'] },
    { ...fixture, expected_answer: 'absent-from-source' },
  )
  for (const value of invalid)
    assert.throws(
      () => evaluateCandidates([value], [valid()]),
      /Fixture|fixture/,
    )
})

test('invalid candidate identities and nonarray candidate files never pass', () => {
  for (const fixture_id of [null, '', 'unknown', ' SYN-PT1 ', 12])
    assert.equal(
      evaluateCandidates([fixture], [{ ...valid(), fixture_id }]).passed,
      false,
    )
  for (const candidates of [null, {}, ''])
    assert.throws(
      () => evaluateCandidates([fixture], candidates),
      /Candidates must be a JSON array/,
    )
})

async function runWithFixtures(values, args = []) {
  const directory = await mkdtemp(join(tmpdir(), 'pharmacy-llm-validation-'))
  try {
    for (const filename of ['evaluate.mjs', 'run.mjs'])
      await copyFile(
        new URL(filename, import.meta.url),
        join(directory, filename),
      )
    await writeFile(join(directory, 'fixtures.json'), JSON.stringify(values))
    return spawnSync(process.execPath, [join(directory, 'run.mjs'), ...args], {
      encoding: 'utf8',
      timeout: 5000,
    })
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}

test('runner rejects invalid fixtures in self-check and prompt modes', async () => {
  for (const values of [
    [],
    [fixture, fixture],
    [{ ...fixture, source_id: null }],
  ]) {
    for (const args of [[], ['--prompts']]) {
      const result = await runWithFixtures(values, args)
      assert.equal(result.error, undefined)
      assert.notEqual(result.status, 0)
      assert.doesNotMatch(result.stdout, /"passed": true/)
      assert.match(result.stderr, /Fixture|fixture/)
    }
  }
})

test('runner preserves synthetic self-check limitations and prompt output for valid fixtures', async () => {
  const result = await runWithFixtures([fixture])
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.equal(report.passed, true)
  assert.equal(report.fixture_count, 1)
  assert.equal(report.inference_performed_by_this_command, false)
  assert.equal(report.provider_access_verified, false)
  assert.equal(report.external_api_calls, 0)
  assert.match(report.limitation, /Synthetic extraction benchmark only/)
  const prompts = await runWithFixtures([fixture], ['--prompts'])
  assert.equal(prompts.status, 0, prompts.stderr)
  assert.equal(JSON.parse(prompts.stdout)[0].fixture_id, fixture.id)
})
