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
    await page.getByRole('button', { name: 'Gửi đáp án' }).click()
    await expect(page.getByRole('heading', { name: /Đáp án:/ })).toBeVisible()
    if (position === 1) {
      await page.reload()
      await expect(
        page.getByText('Đã lưu đáp án A.', { exact: false }),
      ).toBeVisible()
      await page.getByRole('button', { name: 'Xem giải thích' }).click()
      await expect(page.getByRole('heading', { name: /Đáp án:/ })).toBeVisible()
      await page.screenshot({
        path: 'test-results/practice-desktop.png',
        fullPage: true,
      })
    }
    if (position < 10)
      await page.getByRole('button', { name: 'Câu tiếp theo →' }).click()
  }
  expect(formulaSeen).toBe(true)
  await page.getByRole('button', { name: 'Xem kết quả bài luyện' }).click()
  await expect(
    page.getByRole('heading', { name: 'Bạn đã hoàn thành bài luyện.' }),
  ).toBeVisible()
  await expect(page.getByText('Kết quả theo chủ đề')).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Bạn đã hoàn thành bài luyện.' }),
  ).toBeVisible()
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
