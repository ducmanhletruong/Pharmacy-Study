import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import { contentAdmin, learnerB } from './fixtures'
import { signInAs } from './sign-in'

test('an imported question is reviewed, used by a learner, then removed from new practice after a report', async ({
  browser,
}) => {
  const bundle = JSON.parse(
    await readFile(
      new URL('../../content/fixtures/p04-bundle.json', import.meta.url),
      'utf8',
    ),
  )
  const suffix = randomUUID()
  const subjectCode = `p04-e2e-${suffix}`
  bundle.manifest.subject = subjectCode
  bundle.manifest.label += ` — ${suffix}`
  bundle.sources[0].title += ` — ${suffix}`
  // Distinct safe bytes keep global asset SHA provenance isolated across runs.
  const color = suffix.replaceAll('-', '').slice(0, 6)
  bundle.assets[0].data_base64 = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="120" height="80" fill="#${color}"/></svg>`,
  ).toString('base64')
  bundle.questions[0].external_id += `-${suffix}`
  bundle.questions[0].stem += ` (${suffix})`
  const stem: string = bundle.questions[0].stem
  const sourceTitle: string = bundle.sources[0].title
  const adminContext = await browser.newContext()
  const learnerContext = await browser.newContext()
  try {
    const manager = await adminContext.newPage()
    await signInAs(manager, contentAdmin)
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
      .fill('Project-authored synthetic test fixture')
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

    const learner = await learnerContext.newPage()
    await signInAs(learner, learnerB)
    expect(
      (await learner.request.get('/api/v1/admin/questions')).status(),
    ).toBe(403)
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
    const selectedTopic = topic.getByRole('option', { name: /Cộng các số mẫu/ })
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
    await expect(
      learner.getByRole('heading', { name: stem, exact: true }),
    ).toBeVisible()
    const image = learner.getByRole('img', { name: bundle.assets[0].alt_text })
    await expect(image).toBeVisible()
    await expect
      .poll(() =>
        image.evaluate((element: HTMLImageElement) => element.naturalWidth),
      )
      .toBeGreaterThan(0)
    const assetResponse = await learner.request.get(
      (await image.getAttribute('src')) ?? '',
    )
    expect(assetResponse.status()).toBe(200)
    expect(assetResponse.headers()['x-content-type-options']).toBe('nosniff')
    const report = learner.getByRole('region', { name: 'Báo lỗi câu hỏi' })
    await report
      .getByRole('button', { name: 'Báo lỗi câu hỏi', exact: true })
      .click()
    await report
      .getByRole('combobox', { name: 'Loại vấn đề' })
      .selectOption('typo')
    await report
      .getByLabel('Mô tả vấn đề', { exact: true })
      .fill('Báo lỗi tổng hợp để kiểm tra luồng duyệt lại.')
    const reportedResponse = learner.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/questions/${attempt.items[0].question_id}/reports`) &&
        response.request().method() === 'POST',
    )
    await report
      .getByRole('button', { name: 'Gửi báo lỗi', exact: true })
      .click()
    expect((await reportedResponse).ok()).toBe(true)
    await expect(report.getByRole('status')).toContainText('Đã nhận báo lỗi')
    // Existing attempts remain readable, but this sole topic question cannot enter a new attempt.
    expect(
      (await learner.request.get(`/api/v1/attempts/${attempt.id}`)).status(),
    ).toBe(200)
    const unavailable = await learner.request.post('/api/v1/attempts', {
      headers: {
        Origin: new URL(learner.url()).origin,
        'Idempotency-Key': randomUUID(),
      },
      data: {
        subject: subjectCode,
        mode: 'practice',
        count: 1,
        topic_ids: [topicId],
      },
    })
    expect(unavailable.status()).toBe(422)
    expect((await unavailable.json()).error.code).toBe('insufficient_questions')

    await manager.reload()
    await manager.getByRole('button', { name: stem, exact: true }).click()
    await expect(manager.locator('.admin-detail > p')).toContainText(
      'Cần xem lại',
    )
    const pendingReport = manager
      .locator('.admin-report')
      .filter({ hasText: 'Báo lỗi tổng hợp để kiểm tra luồng duyệt lại.' })
    await expect(pendingReport).toBeVisible()
    await pendingReport
      .getByRole('combobox', { name: 'Kết quả xử lý' })
      .selectOption('accepted')
    await pendingReport
      .getByLabel('Ghi chú xử lý', { exact: true })
      .fill('Đã ghi nhận để chỉnh sửa.')
    await pendingReport
      .getByRole('button', { name: 'Lưu xử lý báo lỗi', exact: true })
      .click()
    await expect(pendingReport).toHaveCount(0)
  } finally {
    await learnerContext.close()
    await adminContext.close()
  }
})
