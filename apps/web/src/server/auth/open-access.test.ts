import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const db = vi.hoisted(() => ({
  registerIdentity: vi.fn(),
  sessionMember: vi.fn(),
  createSession: vi.fn(),
  revokeSession: vi.fn(),
}))
vi.mock('@pharmacy/db/auth', () => db)
vi.mock('@pharmacy/db', () => ({ getPool: () => ({}) }))
vi.mock('@pharmacy/db/audit', () => ({ appendAudit: vi.fn() }))
import { authOptions } from './options'
const publicEmail = 'new-user-without-invitation@example.invalid'
beforeEach(() => {
  for (const [key, value] of Object.entries({
    AUTH_MODE: 'oidc',
    NODE_ENV: 'production',
    NEXTAUTH_URL: 'https://study.example.invalid',
    APP_ORIGIN: 'https://study.example.invalid',
    NEXTAUTH_SECRET: 'synthetic-open-access-test-secret-123456789',
    GOOGLE_CLIENT_ID: 'synthetic-google-client',
    GOOGLE_CLIENT_SECRET: 'synthetic-google-secret',
    ADMIN_EMAILS: 'admin@example.invalid',
    INVITED_EMAILS: '',
  }))
    vi.stubEnv(key, value)
  db.registerIdentity.mockReset().mockImplementation(async (input) => ({
    ...input,
    id: randomUUID(),
    status: 'active',
  }))
  db.sessionMember.mockReset()
})
afterEach(() => vi.unstubAllEnvs())
function google(email: string, verified: unknown = true) {
  return {
    user: { id: 'provider-id', email, name: 'Synthetic learner' },
    account: { provider: 'google', providerAccountId: 'provider-id' },
    profile: { email_verified: verified },
  } as never
}
test('verified Google users join without invitation; only configured admin emails receive admin role', async () => {
  const signIn = authOptions().callbacks!.signIn!
  expect(await signIn(google(publicEmail))).toBe(true)
  expect(db.registerIdentity).toHaveBeenLastCalledWith(
    expect.objectContaining({
      provider: 'google',
      email: publicEmail,
      role: 'learner',
    }),
  )
  expect(await signIn(google('ADMIN@example.invalid'))).toBe(true)
  expect(db.registerIdentity).toHaveBeenLastCalledWith(
    expect.objectContaining({ email: 'admin@example.invalid', role: 'admin' }),
  )
})
test('unverified Google email and a disabled account cannot sign in', async () => {
  for (const verified of [false, null, 'true'])
    expect(
      await authOptions().callbacks!.signIn!(google(publicEmail, verified)),
    ).toBe(false)
  const missing = google(publicEmail) as unknown as { profile: unknown }
  missing.profile = {}
  expect(await authOptions().callbacks!.signIn!(missing as never)).toBe(false)
  expect(db.registerIdentity).not.toHaveBeenCalled()
  db.registerIdentity.mockResolvedValueOnce(null)
  expect(await authOptions().callbacks!.signIn!(google(publicEmail))).toBe(
    false,
  )
})
test('guest authorize ignores submitted identities and grants only learner access', async () => {
  const options = authOptions()
  const provider = options.providers.find((p) => p.options?.id === 'guest')!
  const authorize = (
    provider as unknown as {
      options: {
        authorize: (
          credentials: unknown,
        ) => Promise<{ id: string; email: string; name: string }>
      }
    }
  ).options.authorize
  const first = await authorize({
    email: 'admin@example.invalid',
    id: 'attacker-chosen',
    role: 'admin',
  })
  const second = await authorize({ id: first.id, email: first.email })
  expect(second.id).not.toBe(first.id)
  expect(first.email).toBe(`${first.id}@guest.invalid`)
  expect(first.email).not.toBe('admin@example.invalid')
  expect(
    await options.callbacks!.signIn!({
      user: { ...first },
      account: { provider: 'guest', providerAccountId: first.id },
    } as never),
  ).toBe(true)
  expect(db.registerIdentity).toHaveBeenLastCalledWith(
    expect.objectContaining({
      provider: 'guest',
      subject: first.id,
      role: 'learner',
    }),
  )
  expect(
    await options.callbacks!.signIn!({
      user: { ...second, email: 'admin@example.invalid' },
      account: { provider: 'guest', providerAccountId: second.id },
    } as never),
  ).toBe(false)
})
test('guest-only mode does not accept Google or test callback identities', async () => {
  vi.stubEnv('AUTH_MODE', 'guest')
  const signIn = authOptions().callbacks!.signIn!
  expect(await signIn(google(publicEmail))).toBe(false)
  expect(
    await signIn({
      user: { id: 'x', email: publicEmail },
      account: { provider: 'test', providerAccountId: 'x' },
    } as never),
  ).toBe(false)
  expect(db.registerIdentity).not.toHaveBeenCalled()
})
test('session role comes from the active DB member and admin configuration, not client input', async () => {
  const id = randomUUID(),
    sid = randomUUID()
  db.sessionMember.mockResolvedValue({
    id,
    name: 'Khách ẩn danh',
    email: `${id}@guest.invalid`,
    role: 'learner',
    status: 'active',
  })
  const session = await authOptions().callbacks!.session!({
    token: { sub: id, sid },
    session: { expires: '', user: { role: 'admin' } },
    newSession: { user: { role: 'admin' } },
  } as never)
  expect(session.user).toMatchObject({ role: 'learner' })
  db.sessionMember.mockResolvedValueOnce(null)
  const missing = await authOptions().callbacks!.session!({
    token: { sub: id, sid },
    session: { expires: '' },
  } as never)
  expect(missing.user).toBeUndefined()
})
