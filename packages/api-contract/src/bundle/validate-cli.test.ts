import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import {
  DEFAULT_MAX_IMPORT_BYTES,
  importByteLimit,
  validateBundleFile,
} from './validate-cli'

test('CLI byte limits are bounded and default to five MiB', () => {
  expect(importByteLimit(undefined)).toBe(DEFAULT_MAX_IMPORT_BYTES)
  for (const value of ['0', '-1', 'NaN', '1.5', '52428801'])
    expect(() => importByteLimit(value)).toThrow(/MAX_IMPORT_BYTES/)
  expect(importByteLimit('52428800')).toBe(50 * 1024 * 1024)
})
test('file validation refuses oversize/non-JSON/invalid UTF-8 inputs without echoing contents', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'pharmacy-bundle-validator-'))
  try {
    const file = join(directory, 'bundle.json')
    await writeFile(file, ' '.repeat(11))
    await expect(validateBundleFile(file, 10)).rejects.toThrow(
      /exceeds MAX_IMPORT_BYTES/,
    )
    await writeFile(file, 'private-sentinel')
    await expect(validateBundleFile(file)).rejects.toThrow(
      /^Bundle input must be valid UTF-8 JSON$/,
    )
    await writeFile(file, Uint8Array.from([0xff, 0xfe]))
    await expect(validateBundleFile(file)).rejects.toThrow(
      /^Bundle input must be valid UTF-8 JSON$/,
    )
    await expect(validateBundleFile(directory)).rejects.toThrow(/regular file/)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
