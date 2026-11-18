import { expect, test, vi, afterEach } from 'vitest'
vi.mock('@pharmacy/db/auth', () => ({
  registerIdentity: async () => {
    throw new Error('PRIVATE_IDENTITY_SENTINEL')
  },
  createSession: vi.fn(),
  sessionMember: vi.fn(),
  revokeSession: vi.fn(),
}))
import { authOptions } from './options'
afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})
test('identity backend exception becomes a fixed public denial', async () => {
  for (const [key, value] of Object.entries({
    AUTH_MODE: 'test',
    NODE_ENV: 'test',
    NEXTAUTH_URL: 'http://localhost:3001',
    NEXTAUTH_SECRET: 'synthetic-secret-for-identity-tests-only',
    AUTH_TEST_SECRET: 'synthetic-test-password-for-unit-tests',
    ADMIN_EMAILS: 'admin@example.invalid',
  }))
    vi.stubEnv(key, value)
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {})
  const result = await authOptions().callbacks!.signIn!({
    user: { id: 'synthetic', email: 'admin@example.invalid' },
    account: { provider: 'test', providerAccountId: 'synthetic' },
    profile: {},
  } as never)
  expect(result).toBe(false)
  expect(JSON.stringify(logged.mock.calls)).not.toContain(
    'PRIVATE_IDENTITY_SENTINEL',
  )
})
