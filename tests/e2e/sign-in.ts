import { expect, type Page } from '@playwright/test'
import { testPassword, learnerA } from './fixtures'
export async function signInAs(page: Page, email = learnerA) {
  await page.goto('/login')
  await page.getByLabel('Email kiểm thử').fill(email)
  await page.getByLabel('Mật khẩu kiểm thử').fill(testPassword)
  await page
    .getByRole('button', { name: 'Đăng nhập kiểm thử', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: /Môn mẫu tổng hợp/ }),
  ).toBeVisible({ timeout: 15000 })
}
