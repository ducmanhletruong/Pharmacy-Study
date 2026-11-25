import { expect, test } from '@playwright/test'

test('guest sessions are private, resumable and revoked at logout; credentials cannot select an identity', async ({
  page,
  browser,
  context,
}) => {
  await page.goto('/login')
  const providers = await (await page.request.get('/api/auth/providers')).json()
  expect(Object.keys(providers)).toEqual(
    process.env.E2E_GUEST_ONLY === '1' ? ['guest'] : ['test', 'guest'],
  )
  const missingCsrf = await page.request.post('/api/auth/callback/guest', {
    headers: { Origin: 'http://127.0.0.1:3001' },
    form: {},
    maxRedirects: 0,
  })
  expect(missingCsrf.status()).toBeGreaterThanOrEqual(300)
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
  await page
    .getByRole('button', { name: 'Tiếp tục ẩn danh', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: /Môn mẫu tổng hợp/ }),
  ).toBeVisible()
  const me = await (await page.request.get('/api/v1/me')).json()
  expect(me.role).toBe('learner')
  expect(me.name).toBe('Khách ẩn danh')
  expect((await page.request.get('/api/v1/admin/questions')).status()).toBe(403)
  const created = await page.request.post('/api/v1/attempts', {
    headers: {
      Origin: 'http://127.0.0.1:3001',
      'Idempotency-Key': crypto.randomUUID(),
    },
    data: { subject: 'synthetic', mode: 'practice', count: 1 },
  })
  expect(created.status()).toBe(201)
  const attempt = await created.json()
  await page.goto(`/?attempt=${attempt.id}`)
  await expect(page.getByRole('radio').first()).toBeVisible()
  await page.getByRole('radio').first().check()
  await expect(page.getByText('Đã làm', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('radio').first()).toBeChecked()

  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:3001' })
  try {
    const csrf = await (await other.request.get('/api/auth/csrf')).json()
    const response = await other.request.post('/api/auth/callback/guest', {
      headers: { Origin: 'http://127.0.0.1:3001' },
      form: {
        csrfToken: csrf.csrfToken,
        json: 'true',
        callbackUrl: '/',
        email: me.email,
        id: me.id,
        role: 'admin',
      },
    })
    expect(response.ok()).toBe(true)
    const otherMe = await (await other.request.get('/api/v1/me')).json()
    expect(otherMe.role).toBe('learner')
    expect(otherMe.id).not.toBe(me.id)
    expect(otherMe.email).not.toBe(me.email)
    expect(
      (await other.request.get(`/api/v1/attempts/${attempt.id}`)).status(),
    ).toBe(404)
    expect(
      (
        await other.request.put(`/api/v1/attempts/${attempt.id}/items/1`, {
          headers: { Origin: 'http://127.0.0.1:3001' },
          data: { answer: 'B' },
        })
      ).status(),
    ).toBe(404)
    expect((await other.request.get('/api/v1/admin/access')).status()).toBe(403)
  } finally {
    await other.close()
  }

  const session = (await context.cookies()).filter((c) =>
    c.name.includes('session-token'),
  )
  expect(session.length).toBeGreaterThan(0)
  expect(session.every((c) => c.httpOnly && c.sameSite === 'Lax')).toBe(true)
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Vào học ngay.' }),
  ).toBeVisible()
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
  await context.addCookies(session)
  expect(
    (await page.request.get(`/api/v1/attempts/${attempt.id}`)).status(),
  ).toBe(401)
})
