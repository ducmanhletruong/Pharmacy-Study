import { expect, test } from '@playwright/test'
import { signInAs } from './sign-in'
import { admin, learnerA, learnerB, limited, testPassword } from './fixtures'

test('invited member signs in/out, cookies are protected and logged-out token cannot be reused', async ({
  page,
  context,
}) => {
  await signInAs(page)
  const cookies = await context.cookies()
  const session = cookies.filter((cookie) =>
    cookie.name.includes('session-token'),
  )
  expect(session.length).toBeGreaterThan(0)
  expect(
    session.every((cookie) => cookie.httpOnly && cookie.sameSite === 'Lax'),
  ).toBe(true)
  expect((await page.request.get('/api/v1/me')).status()).toBe(200)
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(
    page.getByRole('heading', { name: 'Vào lớp học của bạn.' }),
  ).toBeVisible()
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
  await context.addCookies(session)
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
})
test('outsiders and missing CSRF cannot establish a session', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByLabel('Email kiểm thử').fill('outsider@example.invalid')
  await page.getByLabel('Mật khẩu kiểm thử').fill(testPassword)
  await page
    .getByRole('button', { name: 'Đăng nhập kiểm thử', exact: true })
    .click()
  await expect(page.getByRole('alert')).toBeVisible()
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
  const response = await page.request.post('/api/auth/callback/test', {
    form: { email: learnerA, password: testPassword },
    headers: { Origin: 'http://127.0.0.1:3001' },
    maxRedirects: 0,
  })
  expect(response.status()).toBeGreaterThanOrEqual(300)
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
})
test('real cookie sessions keep learner A separate from B and protect admin routes', async ({
  page,
  browser,
}) => {
  await signInAs(page, learnerA)
  const created = await page.request.post('/api/v1/attempts', {
    data: { subject: 'synthetic', mode: 'practice', count: 1 },
    headers: {
      Origin: 'http://127.0.0.1:3001',
      'Idempotency-Key': crypto.randomUUID(),
    },
  })
  expect(created.status()).toBe(201)
  const attempt = await created.json()
  const otherContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3001',
  })
  try {
    const other = await otherContext.newPage()
    await signInAs(other, learnerB)
    expect(
      (await other.request.get(`/api/v1/attempts/${attempt.id}`)).status(),
    ).toBe(404)
    expect(
      (
        await other.request.put(`/api/v1/attempts/${attempt.id}/items/1`, {
          data: { answer: 'A' },
          headers: { Origin: 'http://127.0.0.1:3001' },
        })
      ).status(),
    ).toBe(404)
    expect(
      (
        await other.request.post(`/api/v1/attempts/${attempt.id}/submit`, {
          headers: { Origin: 'http://127.0.0.1:3001' },
        })
      ).status(),
    ).toBe(404)
    expect((await other.request.get('/api/v1/admin/access')).status()).toBe(403)
    expect((await other.goto('/admin'))?.status()).toBe(404)
  } finally {
    await otherContext.close()
  }
  expect(
    (await page.request.get(`/api/v1/attempts/${attempt.id}`)).status(),
  ).toBe(200)
})
test('admin access requires admin role and client session updates cannot promote a learner', async ({
  page,
  browser,
}) => {
  await signInAs(page, learnerA)
  await page.evaluate(async () => {
    const { csrfToken } = await (await fetch('/api/auth/csrf')).json()
    await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ csrfToken, data: { user: { role: 'admin' } } }),
    })
  })
  expect((await page.request.get('/api/v1/admin/access')).status()).toBe(403)
  const adminContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3001',
  })
  try {
    const owner = await adminContext.newPage()
    await signInAs(owner, admin)
    expect((await owner.request.get('/api/v1/admin/access')).status()).toBe(200)
    await owner.getByRole('link', { name: 'Quản trị', exact: true }).click()
    await expect(
      owner.getByRole('heading', { name: 'Khu vực quản trị lớp.' }),
    ).toBeVisible()
  } finally {
    await adminContext.close()
  }
})
test('security headers, nonce CSP and Origin checks survive the real HTTP server', async ({
  page,
}) => {
  const response = await page.goto('/login')
  const headers = response!.headers()
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['content-security-policy']).toMatch(/nonce-/)
  expect(headers['content-security-policy']).toContain("frame-ancestors 'none'")
  await signInAs(page)
  expect(
    (
      await page.request.post('/api/v1/attempts', {
        data: { subject: 'synthetic', mode: 'practice', count: 1 },
        headers: {
          Origin: 'https://untrusted.invalid',
          'Idempotency-Key': crypto.randomUUID(),
        },
      })
    ).status(),
  ).toBe(403)
  const providers = await (await page.request.get('/api/auth/providers')).json()
  expect(Object.keys(providers)).toEqual(['test'])
})
test('creation quota is enforced over HTTP with Retry-After', async ({
  page,
}) => {
  await signInAs(page, limited)
  for (let i = 0; i < 8; i++) {
    const response = await page.request.post('/api/v1/attempts', {
      data: { subject: 'synthetic', mode: 'practice', count: 1 },
      headers: {
        Origin: 'http://127.0.0.1:3001',
        'Idempotency-Key': crypto.randomUUID(),
      },
    })
    expect(response.status()).toBe(201)
  }
  const denied = await page.request.post('/api/v1/attempts', {
    data: { subject: 'synthetic', mode: 'practice', count: 1 },
    headers: {
      Origin: 'http://127.0.0.1:3001',
      'Idempotency-Key': crypto.randomUUID(),
    },
  })
  expect(denied.status()).toBe(429)
  expect(Number(denied.headers()['retry-after'])).toBeGreaterThan(0)
})
