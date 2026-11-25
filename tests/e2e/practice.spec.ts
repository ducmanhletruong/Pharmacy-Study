import { signInAs } from './sign-in'
import { expect, test } from '@playwright/test'

test('choose a subject, answer ten questions, resume and see explanations and results', async ({
  page,
}) => {
  await signInAs(page)
  await page.getByRole('button', { name: /Môn mẫu tổng hợp/ }).click()
  await page.getByRole('button', { name: 'Bắt đầu luyện →' }).click()
  await expect(page).toHaveURL(/attempt=/)
  let formulaSeen = false
  for (let position = 1; position <= 10; position++) {
    if (await page.locator('.question .katex').count()) formulaSeen = true
    await page.getByRole('radio').first().check()
    await expect(page.getByText('Đã làm', { exact: true })).toBeVisible()
    if (position === 1) {
      await page.reload()
      await page.getByRole('button', { name: 'Đến câu 1', exact: true }).click()
      await expect(page.getByRole('radio').first()).toBeChecked()
      await page.screenshot({
        path: 'test-results/practice-desktop.png',
        fullPage: true,
      })
    }
    if (position < 10)
      await page
        .getByRole('button', { name: 'Câu tiếp theo', exact: true })
        .click()
  }
  expect(formulaSeen).toBe(true)
  await page.getByRole('button', { name: 'Xem kết quả bài luyện' }).click()
  await expect(
    page.getByRole('heading', { name: 'Bạn đã hoàn thành bài luyện.' }),
  ).toBeVisible()
  await expect(page.getByText('Kết quả theo chủ đề')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /^Câu 1 · Đáp án:/ }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Bạn đã hoàn thành bài luyện.' }),
  ).toBeVisible()
})
test('autosave keeps the last choice across navigation and retries before submitting', async ({
  page,
}) => {
  await signInAs(page)
  await page.getByRole('button', { name: /Môn mẫu tổng hợp/ }).click()
  await page.getByRole('button', { name: 'Bắt đầu luyện →' }).click()
  let release!: () => void
  const firstSave = new Promise<void>((resolve) => {
    release = resolve
  })
  const answers: string[] = []
  await page.route('**/api/v1/attempts/*/items/1', async (route) => {
    const answer = route.request().postDataJSON().answer
    answers.push(answer)
    if (answers.length === 1) await firstSave
    if (answers.length === 2) {
      await route.fulfill({
        status: 503,
        json: { error: { message: 'Synthetic interruption' } },
      })
      return
    }
    await route.continue()
  })
  try {
    await expect(
      page.getByRole('button', { name: 'Câu trước', exact: true }),
    ).toBeDisabled()
    await page.locator('input[value=A]').check()
    await expect(page.getByText('Đang lưu…', { exact: true })).toBeVisible()
    await page.locator('input[value=B]').check()
    await page.locator('input[value=D]').check()
    await page
      .getByRole('button', { name: 'Câu tiếp theo', exact: true })
      .click()
    await page.getByRole('button', { name: 'Câu trước', exact: true }).click()
    await expect(page.locator('input[value=D]')).toBeChecked()
    release()
    await expect(
      page.getByRole('button', { name: 'Thử lại', exact: true }),
    ).toBeVisible()
    await expect(page.getByText('Đã làm', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: /^Kết thúc bài/ }).click()
    await expect(page.getByText('Chưa lưu được đáp án ở câu 1.')).toBeVisible()
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(page.getByText('Đã làm', { exact: true })).toBeVisible()
    expect(answers).toEqual(['A', 'D', 'D'])
    await page.reload()
    await page.getByRole('button', { name: 'Đến câu 1', exact: true }).click()
    await expect(page.locator('input[value=D]')).toBeChecked()
  } finally {
    release()
  }
})
test('a PUT that never responds times out and can be retried', async ({
  page,
}) => {
  await signInAs(page)
  await page.getByRole('button', { name: /Môn mẫu tổng hợp/ }).click()
  await page.getByRole('button', { name: 'Bắt đầu luyện →' }).click()
  let release!: () => void
  const stall = new Promise<void>((resolve) => {
    release = resolve
  })
  let saves = 0
  await page.route('**/api/v1/attempts/*/items/1', async (route) => {
    if (++saves === 1) {
      await stall
      await route.abort().catch(() => {})
      return
    }
    await route.continue()
  })
  try {
    await page.locator('input[value=D]').check()
    await page.getByRole('button', { name: /^Kết thúc bài/ }).click()
    await expect(page.getByText('Chưa lưu được đáp án ở câu 1.')).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.locator('input[value=D]')).toBeChecked()
    await page.getByRole('button', { name: 'Thử lại', exact: true }).click()
    await expect(page.getByText('Đã làm', { exact: true })).toBeVisible()
  } finally {
    release()
  }
})
test('mobile selection and practice fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await signInAs(page)
  await page.getByRole('button', { name: /Môn mẫu tổng hợp/ }).click()
  await page.getByRole('button', { name: 'Bắt đầu luyện →' }).click()
  await expect(page.getByRole('radio').first()).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true)
  await page.screenshot({
    path: 'test-results/practice-mobile.png',
    fullPage: true,
  })
})
