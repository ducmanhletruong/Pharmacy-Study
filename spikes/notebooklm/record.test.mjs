import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { appendBatch } from './record.mjs'
import { validateCapture } from './validate.mjs'

// Entirely synthetic; never use these records as notebook access evidence.
const now = Date.parse('2026-01-10T00:00:00Z')
const capture = () => ({
  schema_version: 1,
  synthetic: false,
  server: { name: 'unit-only', version: 'test-only', transport: 'stdio' },
  source_permission: { confirmed: true, basis: 'Synthetic unit fixture only' },
  terms_review: {
    reviewed_at: '2026-01-01T00:00:00Z',
    reviewer: 'unit-fixture',
    notes: 'Not a live terms attestation',
  },
  topics: Array.from({ length: 5 }, (_, index) => ({
    id: `t${index}`,
    label: `Test ${index}`,
  })),
  observations: [],
})
const observation = (index = 0, timestamp = '2026-01-01T18:00:00Z') => ({
  topic_id: `t${index}`,
  observed_at: timestamp,
  response_ok: true,
  grounded_verified: true,
  excerpt: 'Đoạn tổng hợp 🧪, không phải nguồn thật.',
  citations: [{ source_ref: 'synthetic-source', location: 'unit section 1' }],
})

test('hashes the exact Unicode excerpt and excludes raw/unknown response fields', () => {
  const item = { ...observation(), raw_response: 'PRIVATE-TEXT' }
  const result = appendBatch(capture(), [item], now)
  assert.equal(
    result.observations[0].excerpt_sha256,
    createHash('sha256').update(item.excerpt).digest('hex'),
  )
  assert.equal(result.observations[0].excerpt_chars, [...item.excerpt].length)
  assert.equal(JSON.stringify(result).includes(item.excerpt), false)
  assert.equal(JSON.stringify(result).includes('PRIVATE-TEXT'), false)
  assert.equal(validateCapture(result, now).gate_passed, false)
})

test('rejects unverified, future, unknown-topic and missing-locator evidence without mutating history', () => {
  for (const change of [
    { grounded_verified: false },
    { response_ok: false },
    { observed_at: '2099-01-01T00:00:00Z' },
    { topic_id: 'unknown' },
    { citations: [{ source_ref: 'unit-only' }] },
    { excerpt: '' },
  ]) {
    const original = capture()
    assert.throws(() =>
      appendBatch(original, [{ ...observation(), ...change }], now),
    )
    assert.deepEqual(original.observations, [])
  }
  const unconfirmed = capture()
  unconfirmed.source_permission.confirmed = false
  assert.throws(() => appendBatch(unconfirmed, [observation()], now))
})

test('prevents duplicate topic/day by Vietnam time, including in one batch', () => {
  const first = observation(0, '2026-01-01T18:00:00Z')
  const second = observation(0, '2026-01-02T10:00:00Z')
  assert.throws(() => appendBatch(capture(), [first, second], now))
  const recorded = appendBatch(capture(), [first], now)
  assert.throws(() => appendBatch(recorded, [second], now))
  assert.equal(recorded.observations.length, 1)
})

test('preserves earlier days and only passes after five topics on three recorded dates', () => {
  let result = capture()
  for (const day of ['01', '03', '05']) {
    const original = structuredClone(result)
    result = appendBatch(
      result,
      Array.from({ length: 5 }, (_, index) =>
        observation(index, `2026-01-${day}T03:00:00Z`),
      ),
      now,
    )
    assert.deepEqual(
      result.observations.slice(0, original.observations.length),
      original.observations,
    )
    assert.equal(validateCapture(result, now).gate_passed, day === '05')
  }
})

test('CLI saves a partial day, preserves files on rejection and never prints private parse snippets', async () => {
  const root = fileURLToPath(new URL('./private/', import.meta.url))
  await mkdir(root, { recursive: true, mode: 0o700 })
  const directory = await mkdtemp(join(root, 'synthetic-record-test-'))
  const capturePath = join(directory, 'capture.json')
  const batchPath = join(directory, 'batch.json')
  const run = (input = batchPath) =>
    spawnSync(
      process.execPath,
      [
        fileURLToPath(new URL('./record.mjs', import.meta.url)),
        capturePath,
        input,
      ],
      { encoding: 'utf8' },
    )
  try {
    await writeFile(capturePath, JSON.stringify(capture()))
    await writeFile(batchPath, `\uFEFF${JSON.stringify([observation()])}`)
    const recorded = run()
    assert.equal(recorded.status, 2, recorded.stderr)
    assert.equal(JSON.parse(recorded.stdout).added_count, 1)
    const saved = await readFile(capturePath, 'utf8')
    assert.equal(JSON.parse(saved).observations.length, 1)
    assert.equal(saved.includes(observation().excerpt), false)
    assert.equal(run().status, 1)
    assert.equal(await readFile(capturePath, 'utf8'), saved)
    assert.equal(
      run(fileURLToPath(new URL('./capture.template.json', import.meta.url)))
        .status,
      1,
    )
    await writeFile(batchPath, '[{"excerpt":"PRIVATE-PARSE-SNIPPET"}, INVALID]')
    const malformed = run()
    assert.equal(malformed.status, 1)
    assert.equal(
      (malformed.stdout + malformed.stderr).includes('PRIVATE-PARSE-SNIPPET'),
      false,
    )
    assert.equal(await readFile(capturePath, 'utf8'), saved)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
