import { expect, test, vi } from 'vitest'
import { readBody } from './body'
test('a stalled body times out and cancels instead of bypassing authentication limits indefinitely', async () => {
  vi.stubEnv('AUTH_MODE', 'disabled')
  let cancelled = false
  try {
    const stream = new ReadableStream<Uint8Array>({
      cancel() {
        cancelled = true
      },
    })
    const request = new Request('http://localhost', {
      method: 'POST',
      body: stream,
      duplex: 'half',
    } as RequestInit)
    await expect(readBody(request, 10)).rejects.toMatchObject({
      status: 408,
      code: 'request_timeout',
    })
    expect(cancelled).toBe(true)
  } finally {
    vi.unstubAllEnvs()
  }
})
