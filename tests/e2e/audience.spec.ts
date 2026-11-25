import { expect, test } from '@playwright/test'
import { audienceAdmin } from './fixtures'
import { signInAs } from './sign-in'

test('an already-open guest session loses protected attempts after an admin restricts a source', async ({
  page,
  browser,
  baseURL,
}) => {
  await signInAs(page, audienceAdmin)
  const response = await page.request.get('/api/v1/admin/sources')
  expect(response.ok()).toBe(true)
  const { items } = await response.json()
  const source = items.find(
    (row: { locator: string }) =>
      row.locator === 'content/fixtures/practice.json',
  )
  expect(source.audience).toBe('public')
  const guest = await browser.newContext({ baseURL })
  const headers = { Origin: baseURL! }
  let restricted = false
  try {
    const guestPage = await guest.newPage()
    await guestPage.goto('/login')
    await guestPage
      .getByRole('button', { name: 'Tiếp tục ẩn danh', exact: true })
      .click()
    await expect(
      guestPage.getByRole('button', { name: /Môn mẫu tổng hợp/ }),
    ).toBeVisible()
    expect(
      (await guest.request.get('/api/v1/admin/invitations')).status(),
    ).toBe(403)
    const created = await guest.request.post('/api/v1/attempts', {
      headers: { ...headers, 'Idempotency-Key': crypto.randomUUID() },
      data: { subject: 'synthetic', mode: 'practice', type: 'mcq', count: 1 },
    })
    expect(created.status()).toBe(201)
    const attempt = await created.json()
    expect(attempt.items).toHaveLength(1)
    const changed = await page.request.patch('/api/v1/admin/sources', {
      headers,
      data: { id: source.id, expected_audience: 'public', audience: 'class' },
    })
    restricted = changed.ok()
    expect(changed.ok()).toBe(true)
    const hidden = await guest.request.get(`/api/v1/attempts/${attempt.id}`)
    expect(hidden.ok()).toBe(true)
    expect(await hidden.json()).toMatchObject({ items: [] })
    const subjects = await (await guest.request.get('/api/v1/subjects')).json()
    expect(
      subjects.items.find(
        (item: { code: string }) => item.code === 'synthetic',
      ),
    ).toMatchObject({ question_count: 0 })
  } finally {
    if (restricted) {
      const restored = await page.request.patch('/api/v1/admin/sources', {
        headers,
        data: {
          id: source.id,
          expected_audience: 'class',
          audience: 'public',
          rights_basis: 'Project-authored synthetic test fixture',
        },
      })
      expect(restored.ok()).toBe(true)
    }
    await guest.close()
  }
})
