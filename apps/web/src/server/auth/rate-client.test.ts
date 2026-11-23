import { expect, test } from 'vitest'
import { NextRequest } from 'next/server'
import { rateClient } from './rate-client'
test('rate identity is signed and rejects forged IDs while setting private secure cookies', () => {
  const first = rateClient(
    new NextRequest('https://study.example.invalid/api/auth/csrf'),
    'synthetic-rate-secret',
    true,
  )
  expect(first.cookie).toContain('HttpOnly; SameSite=Lax')
  expect(first.cookie).toContain('; Secure')
  const cookie = first.cookie!.split(';')[0]!
  const next = rateClient(
    new NextRequest('https://study.example.invalid/api/auth/csrf', {
      headers: { Cookie: cookie },
    }),
    'synthetic-rate-secret',
    true,
  )
  expect(next.key).toBe(first.key)
  expect(next.cookie).toBeNull()
  const forged = rateClient(
    new NextRequest('https://study.example.invalid/api/auth/csrf', {
      headers: { Cookie: cookie.replace(/.$/, 'x') },
    }),
    'synthetic-rate-secret',
    true,
  )
  expect(forged.key).not.toBe(first.key)
})
