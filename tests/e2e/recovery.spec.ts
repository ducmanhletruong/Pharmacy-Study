import { expect, test } from '@playwright/test'
import { signInAs } from './sign-in'
const attempt = {
  id: '70000000-0000-4000-8000-000000000001',
  subject: 'synthetic',
  mode: 'practice',
  status: 'in_progress',
  items: [
    {
      position: 1,
      question_id: '70000000-0000-4000-8000-000000000002',
      revision_id: '70000000-0000-4000-8000-000000000003',
      stem: 'Synthetic delayed question',
      choices: ['A', 'B', 'C', 'D'].map((label) => ({
        label,
        text: `Choice ${label}`,
      })),
      answer: null,
      flagged: false,
    },
  ],
}
test('reset ignores a late create response', async ({ page }) => {
  await signInAs(page)
  let release!: () => void, started!: () => void
  const barrier = new Promise<void>((resolve) => {
      release = resolve
    }),
    received = new Promise<void>((resolve) => {
      started = resolve
    })
  await page.route('**/api/v1/attempts', async (route) => {
    started()
    await barrier
    await route.fulfill({ status: 201, json: attempt })
  })
  await page.getByRole('button', { name: /Môn mẫu tổng hợp/ }).click()
  await page.getByRole('button', { name: 'Bắt đầu luyện →' }).click()
  await received
  await page.getByRole('link', { name: 'Pharmacy Study — trang chủ' }).click()
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/attempts') &&
      response.request().method() === 'POST',
  )
  release()
  await (await response).finished()
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  )
  await expect(
    page.getByRole('button', { name: /Môn mẫu tổng hợp/ }),
  ).toBeVisible()
  await expect(page).not.toHaveURL(/attempt=/)
  await expect(page.getByText('Synthetic delayed question')).toHaveCount(0)
})
test('invalid resume keeps the catalog and can return to practice', async ({
  page,
}) => {
  await signInAs(page)
  await page.route(
    '**/api/v1/attempts/70000000-0000-4000-8000-000000000001',
    (route) =>
      route.fulfill({
        status: 404,
        json: { error: { message: 'Không tìm thấy bài làm' } },
      }),
  )
  await page.goto('/?attempt=' + attempt.id)
  await expect(page.locator('.error[role=alert]')).toBeVisible()
  await expect(
    page.getByRole('button', { name: /Môn mẫu tổng hợp/ }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Về bộ luyện' }).click()
  await expect(page).not.toHaveURL(/attempt=/)
  await page.getByRole('button', { name: /Môn mẫu tổng hợp/ }).click()
  await expect(
    page.getByRole('button', { name: 'Bắt đầu luyện →' }),
  ).toBeVisible()
})
test('logout failure is shown without claiming success and retry works', async ({
  page,
}) => {
  await signInAs(page)
  let fail = true
  await page.route('**/api/auth/signout', async (route) => {
    if (fail)
      await route.fulfill({
        status: 503,
        json: { error: 'synthetic revoke failure' },
      })
    else await route.continue()
  })
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(page.locator('.error[role=alert]')).toContainText(
    'Chưa thể thu hồi phiên',
  )
  expect((await page.request.get('/api/v1/me')).status()).toBe(200)
  fail = false
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(
    page.getByRole('heading', { name: 'Vào lớp học của bạn.' }),
  ).toBeVisible()
  expect((await page.request.get('/api/v1/me')).status()).toBe(401)
})

test('missing logout CSRF does not revoke a live session', async ({ page }) => {
  await signInAs(page)
  await page.request.post('/api/auth/signout', {
    form: { callbackUrl: '/login', json: 'true' },
    headers: { Origin: 'http://127.0.0.1:3001' },
    maxRedirects: 0,
  })
  expect((await page.request.get('/api/v1/me')).status()).toBe(200)
})
