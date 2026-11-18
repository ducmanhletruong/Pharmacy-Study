import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mock = vi.hoisted(() => ({
  fail: false,
  validCsrf: true,
  token: false,
  hits: new Map<string, number>(),
}))
vi.mock('next-auth/jwt', () => ({
  getToken: async () =>
    mock.token ? { sid: 'synthetic-signed-session' } : null,
}))
vi.mock('./options', () => ({
  authOptions: () => ({
    events: {
      signOut: async () => {
        if (mock.fail) throw new Error('PRIVATE_SENTINEL')
      },
    },
  }),
}))
vi.mock('next-auth', () => ({
  default:
    (options: { events: { signOut: () => Promise<void> } }) => async () => {
      if (mock.validCsrf) {
        try {
          await options.events.signOut()
        } catch {
          /* library swallows event failure */
        }
      }
      return new Response(JSON.stringify({ url: '/login' }), {
        headers: { 'Set-Cookie': 'next-auth.session-token=; Max-Age=0' },
      })
    },
}))
vi.mock('@pharmacy/db/limits', () => ({
  takeRateLimit: async (key: string, limit: number) => {
    const hits = (mock.hits.get(key) ?? 0) + 1
    mock.hits.set(key, hits)
    return { allowed: hits <= limit, retryAfter: 60 }
  },
}))
import { POST } from '../../app/api/auth/[...nextauth]/route'
const context = (action: string) => ({
  params: Promise.resolve({ nextauth: [action] }),
})
function req(path: string, body = 'csrfToken=synthetic') {
  return new NextRequest(`http://localhost:3001/api/auth/${path}`, {
    method: 'POST',
    headers: {
      Host: 'localhost:3001',
      Origin: 'http://localhost:3001',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
}
beforeEach(() => {
  for (const [key, value] of Object.entries({
    AUTH_MODE: 'test',
    NODE_ENV: 'test',
    NEXTAUTH_URL: 'http://localhost:3001',
    APP_ORIGIN: 'http://localhost:3001',
    NEXTAUTH_SECRET: 'synthetic-session-secret-for-unit-tests-only',
    AUTH_TEST_SECRET: 'synthetic-test-password-for-unit-tests',
    ADMIN_EMAILS: 'admin@example.invalid',
    RATE_LIMIT_AUTH: '1',
    RATE_LIMIT_AUTH_GLOBAL: '1',
  }))
    vi.stubEnv(key, value)
  mock.fail = false
  mock.validCsrf = true
  mock.token = false
  mock.hits.clear()
})
afterEach(() => vi.unstubAllEnvs())
test('failed durable revoke returns retryable error without clearing the session; retry succeeds', async () => {
  mock.token = true
  mock.fail = true
  const failure = await POST(req('signout'), context('signout'))
  expect(failure.status).toBe(503)
  expect(failure.headers.get('set-cookie')).not.toContain(
    'next-auth.session-token=',
  )
  expect(await failure.text()).not.toContain('PRIVATE_SENTINEL')
  mock.fail = false
  mock.hits.clear()
  const success = await POST(req('signout'), context('signout'))
  expect(success.status).toBe(200)
  expect(success.headers.get('set-cookie')).toContain(
    'next-auth.session-token=',
  )
})
test('anonymous quota exhaustion cannot block signed session logout', async () => {
  await POST(req('callback'), context('callback'))
  expect((await POST(req('callback'), context('callback'))).status).toBe(429)
  mock.token = true
  expect((await POST(req('signout'), context('signout'))).status).toBe(200)
  expect([...mock.hits.keys()]).toContain(
    'auth:logout:synthetic-signed-session',
  )
})
test('oversized body is rejected before global quota and invalid CSRF never calls revoke', async () => {
  expect(
    (await POST(req('signin', 'x'.repeat(17000)), context('signin'))).status,
  ).toBe(413)
  expect(mock.hits.size).toBe(0)
  mock.fail = true
  mock.validCsrf = false
  mock.token = true
  expect((await POST(req('signout'), context('signout'))).status).toBe(200)
})
