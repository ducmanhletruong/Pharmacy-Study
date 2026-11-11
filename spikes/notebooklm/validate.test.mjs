import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateCapture } from './validate.mjs'

// Synthetic unit fixtures validate the checker; they are never live MCP evidence.
const fixture = () => ({
  schema_version: 1,
  synthetic: false,
  server: { name: 'fixture-server', version: 'test-only', transport: 'stdio' },
  source_permission: { confirmed: true, basis: 'Synthetic unit fixture' },
  terms_review: {
    reviewed_at: '2026-01-01T00:00:00Z',
    reviewer: 'fixture',
    notes: 'Unit fixture only',
  },
  topics: Array.from({ length: 5 }, (_, i) => ({
    id: `t${i}`,
    label: `Fixture ${i}`,
  })),
  observations: [1, 2, 3].flatMap((day) =>
    Array.from({ length: 5 }, (_, i) => ({
      topic_id: `t${i}`,
      observed_at: `2026-01-0${day}T03:00:00Z`,
      response_ok: true,
      grounded_verified: true,
      excerpt_sha256: 'a'.repeat(64),
      excerpt_chars: 100,
      citations: [{ source_ref: 'SYNTHETIC', location: 'fixture section 1' }],
    })),
  ),
})

test('complete record is structurally acceptable; source truth remains an admin review', () => {
  assert.equal(validateCapture(fixture()).gate_passed, true)
})

test('one day repeated fifteen times cannot establish three-day stability', () => {
  const value = fixture()
  for (const observation of value.observations)
    observation.observed_at = '2026-01-01T03:00:00Z'
  assert.equal(validateCapture(value).gate_passed, false)
})

test('rejects missing citations, future captures and unconfirmed rights', () => {
  for (const mutate of [
    (value) => {
      value.observations[0].citations = []
    },
    (value) => {
      value.observations[0].observed_at = '2099-01-01T00:00:00Z'
    },
    (value) => {
      value.source_permission.confirmed = false
    },
    (value) => {
      value.synthetic = true
    },
  ]) {
    const value = fixture()
    mutate(value)
    assert.equal(validateCapture(value).gate_passed, false)
  }
})
