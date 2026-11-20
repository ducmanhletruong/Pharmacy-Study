import { expect, test } from '@playwright/test'
import { signInAs } from './sign-in'
import { admin, learnerA } from './fixtures'
test('admin creates a versioned blueprint through its form', async ({
  page,
}) => {
  await signInAs(page, admin)
  const name = 'P05 blueprint UI ' + crypto.randomUUID()
  await page.goto('/admin')
  await page.getByLabel('Tên cấu hình').fill(name)
  await page.getByLabel('Thời gian (giây)').fill('600')
  await page.getByLabel('Số câu nhóm 1').fill('2')
  await page.getByLabel('Trạng thái cấu hình').selectOption('active')
  await page
    .getByRole('button', { name: 'Lưu cấu hình thi', exact: true })
    .click()
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã lưu cấu hình thi.' }),
  ).toBeVisible()
})

test('learner completes timed mock, sees delayed explanations/progress and can review flags', async ({
  page,
  browser,
}) => {
  await signInAs(page, admin)
  const name = 'P05 E2E ' + crypto.randomUUID()
  const setup = await page.request.post('/api/v1/admin/blueprints', {
    headers: {
      Origin: 'http://127.0.0.1:3001',
      'Idempotency-Key': crypto.randomUUID(),
    },
    data: {
      subject: 'synthetic',
      name,
      status: 'active',
      spec: {
        duration_seconds: 600,
        slots: [{ count: 2 }],
        deadline_policy: 'expired_grade_saved',
      },
    },
  })
  expect(setup.status()).toBe(201)
  const learnerContext = await browser.newContext({
    baseURL: 'http://127.0.0.1:3001',
  })
  try {
    const learner = await learnerContext.newPage()
    await signInAs(learner, learnerA)
    await learner.goto('/study')
    const select = learner.getByLabel('Cấu hình thi')
    await expect(
      select.getByRole('option', { name: new RegExp(name) }),
    ).toBeAttached()
    const bpId = await select
      .getByRole('option', { name: new RegExp(name) })
      .getAttribute('value')
    await select.selectOption(bpId!)
    const created = learner.waitForResponse(
      (r) =>
        r.url().endsWith('/api/v1/attempts') && r.request().method() === 'POST',
    )
    await learner
      .getByRole('button', { name: 'Bắt đầu thi thử', exact: true })
      .click()
    const attempt = await (await created).json()
    expect(JSON.stringify(attempt)).not.toMatch(
      /correct_answer|is_correct|explanation|sources/,
    )
    await expect(learner.getByRole('timer')).toContainText('Thời gian còn lại:')
    await learner.getByRole('radio').first().check()
    const saved = learner.waitForResponse(
      (r) => r.url().includes('/items/1') && r.request().method() === 'PUT',
    )
    await learner
      .getByRole('button', { name: 'Lưu đáp án', exact: true })
      .click()
    expect(await (await saved).json()).toEqual({ saved: true })
    await learner.getByRole('button', { name: 'Đánh dấu ôn lại' }).click()
    await learner.reload()
    await expect(learner.getByRole('radio').first()).toBeChecked()
    await expect(
      learner.getByRole('button', { name: 'Bỏ đánh dấu' }),
    ).toBeVisible()
    await learner.getByRole('button', { name: 'Nộp bài', exact: true }).click()
    await expect(
      learner.getByRole('heading', { name: 'Kết quả bài làm' }),
    ).toBeVisible()
    await expect(
      learner.getByRole('heading', { name: /Câu 1: đáp án/ }),
    ).toBeVisible()
    expect(
      (
        await learner.request.get('/api/v1/me/progress?subject=synthetic')
      ).status(),
    ).toBe(200)
    expect(
      (await learner.request.get('/api/v1/admin/blueprints')).status(),
    ).toBe(403)
    expect(
      (await page.request.get('/api/v1/attempts/' + attempt.id)).status(),
    ).toBe(404)
    await learner.getByRole('button', { name: 'Về thi thử và tiến độ' }).click()
    await learner.getByLabel('Nguồn ôn tập').selectOption('flagged')
    await learner.getByLabel('Số câu ôn tập').fill('1')
    await learner.getByRole('button', { name: 'Bắt đầu ôn lại' }).click()
    await expect(
      learner.getByRole('heading', { name: 'Ôn tập', exact: true }),
    ).toBeVisible()
  } finally {
    await learnerContext.close()
  }
})

test('server deadline ends a mock without revealing answers early or requiring an open tab', async ({
  page,
}) => {
  await signInAs(page, admin)
  const name = 'P05 expiry ' + crypto.randomUUID()
  const response = await page.request.post('/api/v1/admin/blueprints', {
    headers: {
      Origin: 'http://127.0.0.1:3001',
      'Idempotency-Key': crypto.randomUUID(),
    },
    data: {
      subject: 'synthetic',
      name,
      status: 'active',
      spec: {
        duration_seconds: 2,
        slots: [{ count: 1 }],
        deadline_policy: 'expired_grade_saved',
      },
    },
  })
  expect(response.status()).toBe(201)
  const blueprint = await response.json()
  await page.goto('/study')
  await page.getByLabel('Cấu hình thi').selectOption(blueprint.id)
  await page
    .getByRole('button', { name: 'Bắt đầu thi thử', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: 'Kết quả bài làm' }),
  ).toBeVisible({ timeout: 10000 })
  await expect(
    page.getByText('Đã hết giờ — chấm các đáp án đã lưu trước hạn.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    page.getByText('0/1 câu đúng; 1 câu chưa trả lời.', { exact: true }),
  ).toBeVisible()
})
