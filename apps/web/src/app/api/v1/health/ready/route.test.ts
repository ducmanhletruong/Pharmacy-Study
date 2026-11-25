import { expect, test, vi } from 'vitest'
import { GET } from './route'

const { query } = vi.hoisted(() => ({ query: vi.fn() }))
vi.mock('@pharmacy/db', () => ({ getPool: () => ({ query }) }))

test('checks the runtime schema and returns a sanitized 503 on failure', async () => {
  query.mockRejectedValueOnce(Error('private connection details'))
  const failure = await GET()
  expect(failure.status).toBe(503)
  expect(failure.headers.get('Cache-Control')).toBe('no-store')
  expect(await failure.json()).toEqual({ status: 'unavailable' })
  expect(query).toHaveBeenCalledWith(
    expect.stringContaining('row_security_active'),
    [expect.arrayContaining(['public.auth_sessions', 'public.attempts'])],
  )

  query.mockResolvedValueOnce({ rows: [{ ready: false }] })
  expect((await GET()).status).toBe(503)
  query.mockResolvedValueOnce({ rows: [{ ready: true }] })
  const recovered = await GET()
  expect(recovered.status).toBe(200)
  expect(await recovered.json()).toEqual({ status: 'ready' })
})

test('bounds the response and coalesces polls until the blocked query settles', async () => {
  vi.useFakeTimers()
  query.mockClear()
  let finish: () => void = () => {}
  query.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ rows: [{ ready: true }] })
      }),
  )
  try {
    const first = GET()
    const second = GET()
    await vi.advanceTimersByTimeAsync(1500)
    expect((await first).status).toBe(503)
    expect((await second).status).toBe(503)
    expect((await GET()).status).toBe(503)
    expect(query).toHaveBeenCalledTimes(1)

    finish()
    await vi.advanceTimersByTimeAsync(0)
    query.mockResolvedValueOnce({ rows: [{ ready: true }] })
    expect((await GET()).status).toBe(200)
    expect(query).toHaveBeenCalledTimes(2)
  } finally {
    finish()
    vi.useRealTimers()
  }
})
