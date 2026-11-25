import { test, expect } from 'vitest'
import { calcBundle, verifyCalcBundle } from './calc'
import { sha256 } from '../bundle'
import { bundleSchema } from '@pharmacy/api-contract/bundle'
test('calculation payload is validated before bundling and preserves reproducible evidence', () => {
  const result = calcBundle(
    { family: 'strong-acid', decimals: 3, tolerance: 1e-10 },
    'fixture',
    'synthetic',
    5,
  )
  expect(bundleSchema.parse(result.bundle).questions).toHaveLength(5)
  expect(result.calculation_manifest.examples).toHaveLength(5)
  expect(new Set(result.bundle.questions.map((q) => q.stem)).size).toBe(5)
  expect(() =>
    calcBundle(
      { family: 'buffer', decimals: 99, tolerance: 0 },
      'x',
      'synthetic',
    ),
  ).toThrow()
})

test('bundle generation accepts the engine seed limit and preserves reproducibility', () => {
  const template = { family: 'buffer', decimals: 3, tolerance: 1e-10 } as const
  const seed = 'x'.repeat(200)
  const first = calcBundle(template, seed, 'synthetic', 5)
  const second = calcBundle(template, seed, 'synthetic', 5)
  expect(first.bundle.questions).toEqual(second.bundle.questions)
  expect(first.calculation_manifest.seed).toBe(seed)
  expect(
    new Set(first.calculation_manifest.examples.map((e) => e.seed)).size,
  ).toBe(5)
  expect(() => calcBundle(template, seed + 'x', 'synthetic')).toThrow(
    'Invalid seed',
  )
})

test.each(['legacy', 'half-even'] as const)(
  'calculation verification reproduces %s bundles and rejects altered evidence',
  (rounding) => {
    const { bundle, calculation_manifest: manifest } = calcBundle(
      {
        family: 'redox-equivalence-volume',
        decimals: 2,
        tolerance: 1e-10,
        rounding,
      },
      'offline-check',
      'hpt1',
      2,
    )
    const encode = (value: unknown) =>
      new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n')
    const bytes = encode(bundle)
    expect(verifyCalcBundle(bytes, manifest)).toMatchObject({
      verified: 2,
      subject: 'hpt1',
      rounding,
    })
    expect(() =>
      verifyCalcBundle(encode(bundle).subarray(0, bytes.length - 1), manifest),
    ).toThrow(/checksum/)

    const wrongBundle = structuredClone(bundle)
    const firstQuestion = wrongBundle.questions[0]
    if (firstQuestion?.type !== 'mcq') throw Error('Expected an MCQ fixture')
    const choices = firstQuestion.choices
    const correct = choices.find((choice) => choice.is_correct)!
    const wrong = choices.find((choice) => !choice.is_correct)!
    correct.is_correct = false
    wrong.is_correct = true
    const wrongBytes = encode(wrongBundle)
    expect(() =>
      verifyCalcBundle(wrongBytes, {
        ...manifest,
        bundle_sha256: sha256(wrongBytes),
      }),
    ).toThrow(/do not reproduce/)

    const changedLicense = structuredClone(bundle)
    changedLicense.sources[0]!.license = 'Unverified license'
    const changedLicenseBytes = encode(changedLicense)
    expect(() =>
      verifyCalcBundle(changedLicenseBytes, {
        ...manifest,
        bundle_sha256: sha256(changedLicenseBytes),
      }),
    ).toThrow(/do not reproduce/)

    const changedManifest = structuredClone(manifest)
    changedManifest.examples[0]!.parameters[0]! += 1
    expect(() => verifyCalcBundle(bytes, changedManifest)).toThrow(
      /do not reproduce/,
    )
  },
)
