import { test, expect } from 'vitest'
import { calculate } from './index'
test('KTCT example percentages use a factor of100 and preserve value units', () => {
  expect(calculate('surplus-rate', [40, 80]).answer).toBe(50)
  expect(calculate('surplus-mass', [50, 200]).answer).toBe(100)
  expect(calculate('surplus-mass', [125, 12]).reference).toBe(15)
  expect(() => calculate('surplus-rate', [0, 80])).toThrow()
  expect(() => calculate('surplus-mass', [12.5, 100])).toThrow('Integer')
})
