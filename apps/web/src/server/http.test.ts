import { expect, test, vi } from 'vitest'
import { handle } from './http'

vi.mock('./auth/actor', () => ({
  currentActor: async () => ({
    id: 'fixture-learner',
    email: 'fixture@example.invalid',
    role: 'learner',
    status: 'active',
  }),
}))

vi.mock('./security/origin', () => ({
  assertHost: () => {},
  assertOrigin: () => {},
}))

test('an unexpected error logs a safe cause and returns the existing generic 500', async () => {
  const destination = new Request('http://127.0.0.1:3000/api/v1/practice')
  const log = vi.spyOn(console, 'info').mockImplementation(() => {})
  try {
    const response = await handle(destination, async () => {
      throw Object.assign(new Error('private connection details'), {
        code: 'ECONNREFUSED',
      })
    })
    const requestId = response.headers.get('X-Request-Id')
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({
      error: {
        code: 'internal_error',
        message: 'Không thể xử lý yêu cầu',
        details: null,
        requestId,
      },
    })
    expect(log).toHaveBeenCalledExactlyOnceWith(
      JSON.stringify({
        event: 'api.error',
        requestId,
        userId: 'fixture-learner',
        code: 'internal_error',
        status: 500,
        errorType: 'Error',
        causeCode: 'ECONNREFUSED',
      }),
    )
  } finally {
    log.mockRestore()
  }
})
