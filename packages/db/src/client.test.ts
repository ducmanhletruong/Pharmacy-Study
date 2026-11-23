import { expect, test } from 'vitest'
import { readPoolMax } from './client'
test('pool capacity is bounded and integer, with a default of five', () => {
  expect(readPoolMax({})).toBe(5)
  expect(readPoolMax({ DB_POOL_MAX: '12' })).toBe(12)
  for (const DB_POOL_MAX of ['0', '-1', '101', 'NaN', '1.5', ''])
    expect(() => readPoolMax({ DB_POOL_MAX })).toThrow(/DB_POOL_MAX/)
})
