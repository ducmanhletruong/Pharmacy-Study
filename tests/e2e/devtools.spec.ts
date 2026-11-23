import { expect, test } from '@playwright/test'
import { admin, learnerA, testPassword } from './fixtures'

test('development tools are visible only to admins and disappear on logout', async ({
  page,
}) => {
  const tools = page.getByRole('button', { name: 'Open Next.js Dev Tools' })
  await page.goto('/login')
  await expect(page.locator('nextjs-portal')).toBeAttached()
  await expect(tools).toBeHidden()
  await page.getByLabel('Email kiểm thử').fill(admin)
  await page.getByLabel('Mật khẩu kiểm thử').fill(testPassword)
  await page
    .getByRole('button', { name: 'Đăng nhập kiểm thử', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: /Môn mẫu tổng hợp/ }),
  ).toBeVisible()
  await expect(tools).toBeVisible()
  await page.reload()
  await expect(tools).toBeVisible()
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(
    page.getByRole('heading', { name: 'Vào học ngay.' }),
  ).toBeVisible()
  await expect(tools).toBeHidden()
  await page.getByLabel('Email kiểm thử').fill(learnerA)
  await page.getByLabel('Mật khẩu kiểm thử').fill(testPassword)
  await page
    .getByRole('button', { name: 'Đăng nhập kiểm thử', exact: true })
    .click()
  await expect(
    page.getByRole('button', { name: /Môn mẫu tổng hợp/ }),
  ).toBeVisible()
  await expect(tools).toBeHidden()
  await page.reload()
  await expect(tools).toBeHidden()
  await page.getByRole('button', { name: 'Đăng xuất' }).click()
  await expect(
    page.getByRole('heading', { name: 'Vào học ngay.' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Tiếp tục ẩn danh' }).click()
  await expect(
    page.getByRole('button', { name: /Môn mẫu tổng hợp/ }),
  ).toBeVisible()
  await expect(tools).toBeHidden()
  await page.reload()
  await expect(tools).toBeHidden()
})

test('Grammarly body attributes do not raise hydration warnings or expose guest DevTools', async ({
  page,
}) => {
  const hydrationErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && /hydrat/i.test(message.text())) {
      hydrationErrors.push(message.text())
    }
  })
  await page.addInitScript(() => {
    const inject = () => {
      if (!document.body) return false
      document.body.setAttribute('data-new-gr-c-s-check-loaded', '14.1349.0')
      document.body.setAttribute('data-gr-ext-installed', '')
      return true
    }
    if (!inject()) {
      const observer = new MutationObserver(() => {
        if (inject()) observer.disconnect()
      })
      observer.observe(document, { childList: true, subtree: true })
    }
  })
  await page.goto('/login')
  await expect(page.locator('body')).toHaveAttribute(
    'data-new-gr-c-s-check-loaded',
    '14.1349.0',
  )
  await page.getByRole('button', { name: 'Tiếp tục ẩn danh' }).click()
  await expect(
    page.getByRole('button', { name: /Môn mẫu tổng hợp/ }),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByRole('button', { name: /Môn mẫu tổng hợp/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Open Next.js Dev Tools' }),
  ).toBeHidden()
  expect(hydrationErrors).toEqual([])
})
