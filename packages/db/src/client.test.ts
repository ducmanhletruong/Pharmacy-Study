import { expect, test, vi } from 'vitest'
import { closeDb, errorLogFields, getPool, readPoolMax } from './client'
test('pool capacity is bounded and integer, with a default of five', () => {
  expect(readPoolMax({})).toBe(5)
  expect(readPoolMax({ DB_POOL_MAX: '12' })).toBe(12)
  for (const DB_POOL_MAX of ['0', '-1', '101', 'NaN', '1.5', ''])
    expect(() => readPoolMax({ DB_POOL_MAX })).toThrow(/DB_POOL_MAX/)
})

test('an idle pool connection error is handled and logs only a safe cause', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://unused:private@127.0.0.1/unused')
  const log = vi.spyOn(console, 'error').mockImplementation(() => {})
  try {
    const error = Object.assign(new Error('private query'), {
      code: 'ECONNRESET',
    })
    expect(() => getPool().emit('error', error)).not.toThrow()
    expect(log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        event: 'db.pool.error',
        errorType: 'Error',
        causeCode: 'ECONNRESET',
      }),
    )
    expect(
      errorLogFields(
        Object.assign(error, { code: 'private value', name: 'private name' }),
      ),
    ).toEqual({
      errorType: 'Error',
    })
  } finally {
    await closeDb()
    log.mockRestore()
    vi.unstubAllEnvs()
  }
})
