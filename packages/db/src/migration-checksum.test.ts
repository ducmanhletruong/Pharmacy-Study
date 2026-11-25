import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'
import { migrationIdentity } from './migration-checksum'

test('checkout line endings preserve checksum compatibility while SQL edits fail', () => {
  const name = '0017_fixture.sql'
  const lf = 'SELECT 1;\nSELECT 2;\n'
  const crlf = lf.replaceAll('\n', '\r\n')
  const oldHash = createHash('sha256').update(crlf).digest('hex')
  expect(migrationIdentity(name, lf).matches(oldHash)).toBe(true)
  expect(migrationIdentity(name, crlf).hash).toBe(
    migrationIdentity(name, lf).hash,
  )
  expect(
    migrationIdentity(name, lf.replace('SELECT 1', 'SELECT 3')).matches(
      oldHash,
    ),
  ).toBe(false)
})

test('a historical mixed checkout is accepted only for the original migration', () => {
  const name = '0009_learner_workflows.sql'
  const sql = readFileSync(
    new URL('../migrations/' + name, import.meta.url),
    'utf8',
  ).replaceAll('\r\n', '\n')
  const mixed =
    '8326f6f5d7351d40660b88955c63795a485abd0b0236b93194fa781d6772b4ce'
  expect(migrationIdentity(name, sql).matches(mixed)).toBe(true)
  expect(migrationIdentity(name, sql + '\n-- changed').matches(mixed)).toBe(
    false,
  )
  expect(migrationIdentity('0017_fixture.sql', sql).matches(mixed)).toBe(false)
})
