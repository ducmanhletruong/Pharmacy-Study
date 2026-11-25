import { randomUUID } from 'node:crypto'
import { calcBundle } from '../../packages/content-pipeline/src/types/calc'
import { expect, test } from '@playwright/test'
import { calcAdmin, learnerB } from './fixtures'
import { signInAs } from './sign-in'

const bundle = calcBundle(
  { family: 'strong-acid', decimals: 3, tolerance: 1e-10 },
  randomUUID(),
  'synthetic',
).bundle
const suffix = randomUUID()
const subjectCode = `p04-e2e-${suffix}`
bundle.manifest.subject = subjectCode
bundle.manifest.label += ` — ${suffix}`
bundle.sources[0].title += ` — ${suffix}`
bundle.questions[0].external_id += `-${suffix}`
bundle.questions[0].stem += ` (${suffix})`
const stem: string = bundle.questions[0].stem
const sourceTitle: string = bundle.sources[0].title

test.beforeAll(async ({ request }) => {
  await Promise.all(
    ['/login', '/', '/admin', '/api/auth/providers'].map((path) =>
      request.get(path),
    ),
  )
})

test.beforeAll(async ({ browser }) => {
  const adminContext = await browser.newContext()
  try {
    const manager = await adminContext.newPage()
    await signInAs(manager, calcAdmin)
    await manager.goto('/admin')
    await expect(
      manager.getByRole('heading', { name: 'Ngân hàng câu hỏi', exact: true }),
    ).toBeVisible()
    await manager.getByLabel('Tệp bộ câu hỏi', { exact: true }).setInputFiles({
      name: 'synthetic-content.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(bundle)),
    })
    const importedResponse = manager.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/admin/imports') &&
        response.request().method() === 'POST',
    )
    await manager
      .getByRole('button', { name: 'Nhập bộ câu hỏi', exact: true })
      .click()
    const imported = await importedResponse
    expect(imported.ok()).toBe(true)
    const importResult = await imported.json()
    expect(importResult.counts.created).toBe(1)
    await manager.getByRole('button', { name: stem, exact: true }).click()
    await expect(manager.locator('.admin-detail > p')).toContainText('Bản nháp')
    const nextStatus = manager.getByRole('combobox', {
      name: 'Trạng thái tiếp theo',
    })
    await expect(nextStatus.locator('option[value=approved]')).toHaveCount(0)
    await manager
      .getByRole('button', { name: `Duyệt nguồn ${sourceTitle}`, exact: true })
      .click()
    await expect(manager.locator('.admin-message')).toHaveText(
      'Đã cập nhật đánh giá nguồn tài liệu.',
    )
    const sourcePanel = manager.locator('.admin-source-list li').filter({
      has: manager.getByRole('heading', { name: sourceTitle, exact: true }),
    })
    await sourcePanel
      .getByLabel('Phạm vi xem nguồn ' + sourceTitle)
      .selectOption('public')
    await sourcePanel
      .getByLabel('Căn cứ quyền chia sẻ')
      .fill('Project-authored calculation fixture')
    await sourcePanel
      .getByRole('button', { name: 'Xác nhận mở phạm vi' })
      .click()
    await expect(manager.locator('.admin-message')).toHaveText(
      'Đã cập nhật phạm vi xem nguồn.',
    )
    await nextStatus.selectOption('verified')
    await manager
      .getByRole('button', { name: 'Cập nhật trạng thái', exact: true })
      .click()
    await expect(manager.locator('.admin-detail > p')).toContainText(
      'Đã xác minh',
    )
    await nextStatus.selectOption('approved')
    await manager
      .getByRole('button', { name: 'Cập nhật trạng thái', exact: true })
      .click()
    await expect(manager.locator('.admin-detail > p')).toContainText('Đã duyệt')
  } finally {
    await adminContext.close()
  }
})

test('calculation bundle is reviewed and renders chemistry, units and verified feedback', async ({
  page,
}) => {
  const learner = page
  await signInAs(learner, learnerB)
  expect((await learner.request.get('/api/v1/admin/questions')).status()).toBe(
    403,
  )
  expect(
    (
      await learner.request.post('/api/v1/admin/imports', {
        headers: { Origin: new URL(learner.url()).origin },
        data: {},
      })
    ).status(),
  ).toBe(403)
  const catalog = await (await learner.request.get('/api/v1/subjects')).json()
  const subject = catalog.items.find(
    (item: { code: string; name: string }) => item.code === subjectCode,
  )
  expect(subject).toBeTruthy()
  await learner
    .locator('.subject-card')
    .filter({
      has: learner.getByRole('heading', { name: subject.name, exact: true }),
    })
    .click()
  const topic = learner.getByRole('combobox', { name: /^Chủ đề/ })
  const selectedTopic = topic.getByRole('option', {
    name: /Bài tính ví dụ tổng hợp/,
  })
  const topicId = await selectedTopic.getAttribute('value')
  expect(topicId).toBeTruthy()
  await topic.selectOption(topicId!)
  await learner.getByRole('combobox', { name: /^Số câu/ }).selectOption('1')
  const createdResponse = learner.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/attempts') &&
      response.request().method() === 'POST',
  )
  await learner.getByRole('button', { name: 'Bắt đầu luyện →' }).click()
  const created = await createdResponse
  expect(created.status()).toBe(201)
  const attempt = await created.json()
  expect(attempt.items).toHaveLength(1)
  await expect(learner.locator('.question')).toBeVisible()
  await expect(learner.locator('.question .katex').first()).toBeVisible()
  await expect(learner.locator('.katex-error')).toHaveCount(0)
  const correct = bundle.questions[0]!.choices.find((c) => c.is_correct)!
  await learner
    .locator('input[type=radio][value=' + correct.label + ']')
    .check()
  await expect(learner.getByText('Đã làm', { exact: true })).toBeVisible()
  await expect(learner.locator('.katex-error')).toHaveCount(0)
  await learner
    .getByRole('button', { name: 'Xem kết quả bài luyện', exact: true })
    .click()
  await expect(learner.locator('.score')).toHaveText(/10\.0\s*\/10/)
  await expect(learner.getByRole('heading', { name: /Đáp án:/ })).toBeVisible()
})
