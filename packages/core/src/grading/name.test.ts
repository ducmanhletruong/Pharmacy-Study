import { expect, test } from 'vitest'
import { gradeChemicalName, normalizeChemicalName } from './name'

test('name grading normalizes typography but keeps locants, stereochemistry and explicit synonyms', () => {
  expect(
    gradeChemicalName(' ( R ) – 2 , 3 - dichlorobutane ', [
      '(R)-2,3-dichlorobutane',
    ]),
  ).toBe(true)
  expect(
    gradeChemicalName('(S)-2,3-dichlorobutane', ['(R)-2,3-dichlorobutane']),
  ).toBe(false)
  expect(
    gradeChemicalName('(R)-1,3-dichlorobutane', ['(R)-2,3-dichlorobutane']),
  ).toBe(false)
  expect(gradeChemicalName('Acetone', ['propan-2-one'])).toBe(false)
  expect(gradeChemicalName('Acetone', ['propan-2-one', 'acetone'])).toBe(true)
  expect(gradeChemicalName(' ', [''])).toBe(false)
})

test('preserves case distinctions inside parenthesized stereodescriptors', () => {
  const primary = '(2R,3r,4S)-pentane-2,3,4-triol'
  expect(normalizeChemicalName(primary)).toBe('(2r,3r,4s)-pentane-2,3,4-triol')
  expect(
    gradeChemicalName('(2R, 3r, 4S) – Pentane-2,3,4-triol', [primary]),
  ).toBe(true)
  expect(gradeChemicalName('(2R,3R,4S)-pentane-2,3,4-triol', [primary])).toBe(
    false,
  )
  expect(gradeChemicalName('(2r,3r,4S)-pentane-2,3,4-triol', [primary])).toBe(
    false,
  )
  expect(gradeChemicalName('(2R,3r,4s)-pentane-2,3,4-triol', [primary])).toBe(
    false,
  )
  expect(
    gradeChemicalName('(2R,3r,4s)-pentane-2,3,4-triol', [
      '(2R,3r,4s)-pentane-2,3,4-triol',
    ]),
  ).toBe(true)
})
