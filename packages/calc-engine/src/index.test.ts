import { test, expect } from 'vitest'
import { generate, calculate, families, format } from './index'
for (const family of families)
  test(`${family}: 1000 seeded examples agree independently and choices stay distinct after rounding`, () => {
    for (let i = 0; i < 1000; i++) {
      const result = generate(
        { family, decimals: i % 4, tolerance: 1e-10 },
        'p07:' + i,
      )
      expect(
        Math.abs(Number(result.answer) - result.reference),
      ).toBeLessThanOrEqual(0.500001 * 10 ** -(i % 4))
      expect(new Set(result.choices.map((c) => c.text)).size).toBe(4)
      expect(result.choices.filter((c) => c.is_correct)).toHaveLength(1)
      expect(
        generate({ family, decimals: i % 4, tolerance: 1e-10 }, 'p07:' + i),
      ).toEqual(result)
    }
  })
test('known examples, sample convention and invalid domains', () => {
  expect(calculate('sample-sd', [1, 2, 3]).answer).toBe(1)
  expect(calculate('sample-sd', [-1, 0, 1]).answer).toBe(1)
  expect(calculate('sample-sd', [1, 2, 3]).mean).toBe(2)
  expect(calculate('buffer', [4.75, 10, 10]).answer).toBe(4.75)
  expect(calculate('weak-acid-concentration', [3, 4]).answer).toBeCloseTo(
    0.011,
    12,
  )
  expect(calculate('surplus-rate', [200, 100]).answer).toBe(200)
  expect(calculate('surplus-mass', [200, 100]).answer).toBe(200)
  expect(() => calculate('strong-acid', [0])).toThrow()
  expect(() =>
    generate({ family: 'buffer', decimals: -1, tolerance: 0 }, 'x'),
  ).toThrow()
})

test('a maximum-length seed also supports deterministic choice ordering', () => {
  const template = { family: 'buffer', decimals: 3, tolerance: 1e-10 } as const
  const seed = 'x'.repeat(200)
  expect(generate(template, seed)).toEqual(generate(template, seed))
  expect(() => generate(template, seed + 'x')).toThrow('Invalid seed')
})

test('weak acid mass uses the solution volume and molar mass', () => {
  const result = calculate('weak-acid-mass', [3, 4, 0.5, 100])
  expect(result.answer).toBeCloseTo(0.55, 12)
  expect(result.reference).toBeCloseTo(result.answer, 12)
  expect(() => calculate('weak-acid-mass', [3, 4, 500, 100])).toThrow(
    'outside example domain',
  )
})

test('weak acid titration accounts for dilution and water at both stages', () => {
  expect(calculate('weak-acid-titration', [3.5, 0.05, 0.5]).answer).toBeCloseTo(
    3.515890002,
    8,
  )
  expect(calculate('weak-acid-titration', [3.5, 0.05, 1]).answer).toBeCloseTo(
    7.951691918,
    8,
  )
  expect(() => calculate('weak-acid-titration', [3.5, 0.05, 0.75])).toThrow(
    'outside example domain',
  )
  expect(calculate('weak-acid-titration', [2.8, 0.05, 0.5]).answer).toBeCloseTo(
    2.870391941,
    8,
  )
})

test('one-electron redox titration uses the potential gap for log K and the midpoint for the equivalence potential', () => {
  const potentials = [1.4416, 0.85]
  expect(calculate('redox-titration', [...potentials, 1]).answer).toBeCloseTo(
    10,
    10,
  )
  expect(calculate('redox-titration', [...potentials, 2]).answer).toBeCloseTo(
    1.1458,
    10,
  )
  expect(() => calculate('redox-titration', [...potentials, 3])).toThrow(
    'outside example domain',
  )
  expect(
    calculate('redox-titration', [1.44, 0.85, 1, 0.059]).answer,
  ).toBeCloseTo(10, 10)
})

test('redox equivalence volume distinguishes titrant and total solution', () => {
  expect(
    calculate('redox-equivalence-volume', [24, 0.15, 0.2, 1]).answer,
  ).toBeCloseTo(18, 12)
  expect(
    calculate('redox-equivalence-volume', [24, 0.15, 0.2, 2]).answer,
  ).toBeCloseTo(42, 12)
  expect(() =>
    calculate('redox-equivalence-volume', [24, 0.15, 0.2, 3]),
  ).toThrow('outside example domain')
})

test('EDTA equivalence uses the conditional constant and reports free metal in μmol/L', () => {
  expect(calculate('edta-equivalence', [10, 2, 0.01001]).answer).toBeCloseTo(
    10,
    10,
  )
  expect(() => calculate('edta-equivalence', [10, 0.5, 0.01])).toThrow(
    'outside example domain',
  )
})

test('EDTA side reactions distinguish free metal from total metal outside MY', () => {
  expect(
    calculate('edta-metal-side-reactions', [10, 2, 0.00501, 2]).answer,
  ).toBeCloseTo(5, 10)
  expect(calculate('edta-metal-side-reactions', [10, 2, 0.00501, 1])).toEqual(
    calculate('edta-equivalence', [10, 2, 0.00501]),
  )
  expect(() =>
    calculate('edta-metal-side-reactions', [10, 2, 0.00501]),
  ).toThrow('Invalid parameter count')
})

test('active EDTA concentration uses only the Y⁴⁻ fraction of uncomplexed ligand', () => {
  const result = calculate('edta-active-ligand', [14, 5, 0.00501, 20])
  expect(result.answer).toBeCloseTo(100, 10)
  expect(result.reference).toBeCloseTo(result.answer, 10)
  expect(() => calculate('edta-active-ligand', [14, 5, 0.00501])).toThrow(
    'Invalid parameter count',
  )
})

test('diprotic salt solubility increases when the anion is protonated', () => {
  const acidic = calculate('diprotic-salt-solubility', [2, 2, 4, 8]).answer
  const neutral = calculate('diprotic-salt-solubility', [7, 2, 4, 8]).answer
  expect(acidic).toBeCloseTo(1417.744687876, 8)
  expect(neutral).toBeCloseTo(100.049988006, 8)
  expect(() => calculate('diprotic-salt-solubility', [2, 2, 4])).toThrow(
    'Invalid parameter count',
  )
})

test('two monovalent cations per anion give the cubic solubility law', () => {
  const acidic = calculate('diprotic-2-to-1-solubility', [2, 2, 4, 12])
  const neutral = calculate('diprotic-2-to-1-solubility', [7, 2, 4, 12])
  expect(acidic.answer).toBeCloseTo(369.016134605, 8)
  expect(neutral.answer).toBeCloseTo(63.017044393, 8)
  expect(acidic.reference).toBeCloseTo(acidic.answer, 8)
})

test('the solubility ratio matches two separate saturated equilibria', () => {
  const ratio = calculate('diprotic-2-to-1-solubility-ratio', [2, 4])
  expect(ratio.answer).toBeCloseTo(5.855814695, 9)
  expect(ratio.reference).toBeCloseTo(ratio.answer, 12)
  expect(() => calculate('diprotic-2-to-1-solubility-ratio', [2])).toThrow(
    'Invalid parameter count',
  )
})

test('HPT1 practice rounds decimal ties to even without changing legacy results', () => {
  expect(format(2.345, 2, 'half-even')).toBe('2.34')
  expect(format(2.355, 2, 'half-even')).toBe('2.36')
  expect(format(-2.345, 2, 'half-even')).toBe('-2.34')
  expect(format(-0.005, 2, 'half-even')).toBe('0.00')
  const template = {
    family: 'redox-equivalence-volume',
    decimals: 2,
    tolerance: 1e-10,
  } as const
  const seed = 'hpt-round-23'
  const legacy = generate(template, seed)
  const practice = generate({ ...template, rounding: 'half-even' }, seed)
  expect(legacy.answer).toBe('27.63')
  expect(practice.answer).toBe('27.62')
  expect(practice.parameters).toEqual(legacy.parameters)
  expect(practice.stem).toContain('giữ chữ số cuối chẵn')
  expect(practice.explanation).toContain('27.62 mL')
  expect(practice.choices.filter((choice) => choice.is_correct)).toMatchObject([
    { text: '27.62 mL' },
  ])
  expect(new Set(practice.choices.map((choice) => choice.text)).size).toBe(4)
})
