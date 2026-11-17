import { afterEach, expect, test, vi } from 'vitest'
import { readAuthConfig } from '../../../../apps/web/src/config'
import { invitedRole } from '../../../../apps/web/src/server/auth/membership'
import { authOptions } from '../../../../apps/web/src/server/auth/options'
import { securityHeaders } from '../../../../apps/web/src/server/security/headers'

const base = {
  AUTH_MODE: 'oidc',
  NODE_ENV: 'production',
  NEXTAUTH_URL: 'https://study.example.invalid',
  NEXTAUTH_SECRET: 'synthetic-secret-for-config-tests-1234567890',
  GOOGLE_CLIENT_ID: 'synthetic-google-id',
  GOOGLE_CLIENT_SECRET: 'synthetic-google-client-secret',
  ADMIN_EMAILS: 'Admin@example.invalid',
  INVITED_EMAILS: ' learner@example.invalid ',
}
afterEach(() => vi.unstubAllEnvs())
test('invitation is exact, case-insensitive and admin list takes precedence', () => {
  for (const [key, value] of Object.entries({ ...base, NODE_ENV: 'test' }))
    vi.stubEnv(key, value)
  expect(invitedRole(' ADMIN@EXAMPLE.INVALID ')).toBe('admin')
  expect(invitedRole('learner@example.invalid')).toBe('learner')
  expect(invitedRole('outside@example.invalid')).toBeNull()
  vi.stubEnv('INVITED_EMAILS', '*@example.invalid')
  expect(() => readAuthConfig()).toThrow(/email/)
})
test('production rejects dev/test modes, missing secrets and non-HTTPS OIDC', () => {
  for (const AUTH_MODE of ['dev', 'test'])
    expect(() => readAuthConfig({ ...base, AUTH_MODE })).toThrow(/forbidden/)
  for (const change of [
    { NEXTAUTH_SECRET: '' },
    { GOOGLE_CLIENT_SECRET: '' },
    { ADMIN_EMAILS: '' },
    { NEXTAUTH_URL: 'http://study.example.invalid' },
    { APP_ORIGIN: 'https://other.invalid' },
  ])
    expect(() => readAuthConfig({ ...base, ...change })).toThrow()
  expect(readAuthConfig(base).admins).toEqual(['admin@example.invalid'])
  expect(() =>
    readAuthConfig({ ...base, APP_ORIGIN: 'private-config-sentinel' }),
  ).toThrow(/^Invalid APP_ORIGIN configuration$/)
})
test('only Google is registered for production even when a test secret is present', () => {
  for (const [key, value] of Object.entries({
    ...base,
    AUTH_TEST_SECRET: 'synthetic-test-only-password-value',
  }))
    vi.stubEnv(key, value)
  const options = authOptions()
  expect(options.providers.map((provider) => provider.id)).toEqual(['google'])
  expect(options.session?.strategy).toBe('jwt')
  expect(options.useSecureCookies).toBe(true)
})
test('CSP has a nonce and denies framing/object scripts; production has no unsafe script allowances', () => {
  const headers = securityHeaders('synthetic-nonce', true)
  const policy = headers.get('Content-Security-Policy')!
  const scripts = policy
    .split('; ')
    .find((part) => part.startsWith('script-src'))!
  expect(scripts).toContain("'nonce-synthetic-nonce'")
  expect(scripts).not.toMatch(/unsafe-inline|unsafe-eval/)
  expect(policy).toContain("frame-ancestors 'none'")
  expect(policy).toContain("object-src 'none'")
  expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
  expect(headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
})
