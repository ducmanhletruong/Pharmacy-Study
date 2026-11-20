import { afterEach, expect, test, vi } from 'vitest'
import { readAuthConfig } from '../../../../apps/web/src/config'
import { loginRole } from '../../../../apps/web/src/server/auth/membership'
import { authOptions } from '../../../../apps/web/src/server/auth/options'
import { securityHeaders } from '../../../../apps/web/src/server/security/headers'

const base = {
  AUTH_MODE: 'oidc',
  NODE_ENV: 'production',
  NEXTAUTH_URL: 'https://study.example.invalid',
  APP_ORIGIN: 'https://study.example.invalid',
  NEXTAUTH_SECRET: 'synthetic-secret-for-config-tests-1234567890',
  GOOGLE_CLIENT_ID: 'synthetic-google-id',
  GOOGLE_CLIENT_SECRET: 'synthetic-google-client-secret',
  ADMIN_EMAILS: 'Admin@example.invalid',
  INVITED_EMAILS: ' learner@example.invalid ',
}
afterEach(() => vi.unstubAllEnvs())
test('public learners need no invitation; admin mapping is exact and case-insensitive', () => {
  for (const [key, value] of Object.entries({ ...base, NODE_ENV: 'test' }))
    vi.stubEnv(key, value)
  expect(loginRole(' ADMIN@EXAMPLE.INVALID ')).toBe('admin')
  expect(loginRole('learner@example.invalid')).toBe('learner')
  expect(loginRole('outside@example.invalid')).toBe('learner')
  expect(loginRole('not-an-email')).toBeNull()
  expect(loginRole('admin@example.invalid.attacker.com')).toBe('learner')
  vi.stubEnv('INVITED_EMAILS', '*@example.invalid')
  expect(readAuthConfig().admins).toEqual(['admin@example.invalid'])
  vi.stubEnv('ADMIN_EMAILS', '*@example.invalid')
  expect(() => readAuthConfig()).toThrow(/email/)
})
test('production rejects dev/test modes, missing secrets and non-HTTPS OIDC', () => {
  for (const AUTH_MODE of ['dev', 'test'])
    expect(() => readAuthConfig({ ...base, AUTH_MODE })).toThrow(/forbidden/)
  for (const change of [
    { NEXTAUTH_SECRET: '' },
    { GOOGLE_CLIENT_SECRET: '' },
    { NEXTAUTH_URL: 'http://study.example.invalid' },
    { APP_ORIGIN: 'https://other.invalid' },
  ])
    expect(() => readAuthConfig({ ...base, ...change })).toThrow()
  expect(readAuthConfig(base).admins).toEqual(['admin@example.invalid'])
  expect(() =>
    readAuthConfig({ ...base, APP_ORIGIN: 'private-config-sentinel' }),
  ).toThrow(/^Invalid APP_ORIGIN configuration$/)
})
test('production enables Google and guests but never the test provider', () => {
  for (const [key, value] of Object.entries({
    ...base,
    AUTH_TEST_SECRET: 'synthetic-test-only-password-value',
  }))
    vi.stubEnv(key, value)
  const options = authOptions()
  expect(
    options.providers.map((provider) => provider.options?.id ?? provider.id),
  ).toEqual(['google', 'guest'])
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

test('runtime limits reject invalid values and production requires an explicit origin', () => {
  for (const MAX_BODY_BYTES of ['0', '-1', '1.5', 'NaN', '1048577'])
    expect(() => readAuthConfig({ ...base, MAX_BODY_BYTES })).toThrow()
  expect(
    readAuthConfig({ ...base, MAX_BODY_BYTES: '1024' }).MAX_BODY_BYTES,
  ).toBe(1024)
  expect(readAuthConfig({}).DEV_HOST).toBe('127.0.0.1')
  expect(() => readAuthConfig({ ...base, APP_ORIGIN: undefined })).toThrow(
    /APP_ORIGIN is required/,
  )
  expect(() => readAuthConfig({ DEV_HOST: 'untrusted.invalid' })).toThrow(
    /DEV_HOST/,
  )
})

test('guest-only mode works without Google credentials/admin list but requires secure session config', () => {
  const config = {
    ...base,
    AUTH_MODE: 'guest',
    ADMIN_EMAILS: '',
    GOOGLE_CLIENT_ID: '',
    GOOGLE_CLIENT_SECRET: '',
  }
  expect(readAuthConfig(config).admins).toEqual([])
  expect(readAuthConfig({ ...base, ADMIN_EMAILS: '' }).admins).toEqual([])
  expect(() => readAuthConfig({ ...config, NEXTAUTH_SECRET: '' })).toThrow()
  expect(() =>
    readAuthConfig({ ...config, NEXTAUTH_URL: 'http://study.example.invalid' }),
  ).toThrow(/HTTPS/)
  for (const [key, value] of Object.entries(config)) vi.stubEnv(key, value)
  const options = authOptions()
  expect(options.providers.map((p) => p.options?.id ?? p.id)).toEqual(['guest'])
  expect(options.useSecureCookies).toBe(true)
})
