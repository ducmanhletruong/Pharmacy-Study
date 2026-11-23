import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { signInAs } from './sign-in'
import { learnerA, learnerB } from './fixtures'
import path from 'node:path'
test('private written exam uploads, resumes, submits and saves clearly labelled manual grades', async ({
  page,
  browser,
}) => {
  await signInAs(page, learnerA)
  await page.goto('/written')
  const name = 'Written E2E ' + crypto.randomUUID()
  await page.getByLabel('Tên đề tự luận').fill(name)
  await page.getByLabel('Điểm từng câu', { exact: true }).fill('4;6')
  await page.getByLabel('PDF đề riêng', { exact: true }).setInputFiles({
    name: 'synthetic-written.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.concat([
      readFileSync(path.resolve('content/fixtures/written-synthetic.pdf')),
      Buffer.alloc(20000, 32),
    ]),
  })
  await page
    .getByLabel('PDF tài liệu đối chiếu (tùy chọn)', { exact: true })
    .setInputFiles({
      name: 'synthetic-written.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.concat([
        readFileSync(path.resolve('content/fixtures/written-synthetic.pdf')),
        Buffer.alloc(20000, 32),
      ]),
    })
  const uploaded = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/v1/me/written-papers') &&
      r.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Lưu đề tự luận riêng', exact: true })
    .click()
  const paper = await (await uploaded).json()
  expect(paper.id).toBeTruthy()
  await expect(page.getByRole('status')).toContainText('Đã thêm đề riêng')
  const started = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/v1/me/written-attempts') &&
      r.request().method() === 'POST',
  )
  await page
    .getByRole('button', { name: 'Bắt đầu thi tự luận', exact: true })
    .click()
  const attempt = await (await started).json()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
  await page
    .getByLabel('Bài viết Câu 1', { exact: true })
    .fill('Synthetic saved response with reasoning.')
  await page.getByRole('button', { name: 'Lưu Câu 1', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Đã lưu câu 1')
  await page.reload()
  await expect(page.getByLabel('Bài viết Câu 1', { exact: true })).toHaveValue(
    'Synthetic saved response with reasoning.',
  )
  expect(
    (
      await page.request.get(
        `/api/v1/me/written-papers/${paper.id}/pdf?reference_for=${attempt.id}`,
      )
    ).status(),
  ).toBe(403)
  const other = await browser.newContext({ baseURL: 'http://127.0.0.1:3001' })
  try {
    const otherPage = await other.newPage()
    await signInAs(otherPage, learnerB)
    expect(
      (
        await otherPage.request.get('/api/v1/me/written-attempts/' + attempt.id)
      ).status(),
    ).toBe(404)
    expect(
      (
        await otherPage.request.get(
          '/api/v1/me/written-papers/' + paper.id + '/pdf',
        )
      ).status(),
    ).toBe(404)
  } finally {
    await other.close()
  }
  await page
    .getByRole('button', { name: 'Nộp bài tự luận', exact: true })
    .click()
  await expect(
    page.getByLabel('Bài viết Câu 1', { exact: true }),
  ).toHaveAttribute('readonly', '')
  await page.getByLabel('Điểm tự chấm Câu 1', { exact: true }).fill('3')
  await page.getByLabel('Điểm tự chấm Câu 2', { exact: true }).fill('4.5')
  await page
    .getByRole('button', { name: 'Lưu điểm tự chấm', exact: true })
    .click()
  await expect(
    page.getByText('7.50/10 — tự chấm', { exact: false }),
  ).toBeVisible()
  expect(
    (
      await page.request.get(
        `/api/v1/me/written-papers/${paper.id}/pdf?reference_for=${attempt.id}`,
      )
    ).status(),
  ).toBe(200)
})
