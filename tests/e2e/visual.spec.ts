import { expect, test } from '@playwright/test'
import { visualAdmin } from './fixtures'
import { signInAs } from './sign-in'

test('a learner view answers a structure name and a hotspot using the keyboard', async ({
  page,
  baseURL,
}) => {
  await signInAs(page, visualAdmin)
  const headers = { Origin: baseURL! }
  const subject = 'visual-e2e-' + crypto.randomUUID()
  const bankName = 'Visual exercises for ' + subject
  const common = {
    difficulty: 1,
    explanation: 'Synthetic visual answer comparison.',
    topic_codes: ['fixtures'],
    sources: [{ source_ref: 'local', locator: 'fixture' }],
  }
  const svg = (line: string) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><path d="${line}" stroke="black"/></svg>`,
    ).toString('base64')
  const asset = (ref: string, line: string) => ({
    ref,
    kind: 'svg',
    data_base64: svg(line),
    license: 'project-authored',
    attribution: 'Synthetic fixture',
    alt_text: 'Abstract figure',
    source_ref: 'local',
  })
  const created = await page.request.post('/api/v1/admin/imports', {
    headers,
    data: {
      schema_version: 1,
      manifest: {
        subject,
        label: bankName,
        generator: { name: 'test', version: '1' },
        created_at: new Date().toISOString(),
      },
      topics: [
        { code: 'fixtures', title: 'Visual fixtures', parent_code: null },
      ],
      sources: [
        {
          ref: 'local',
          kind: 'manual',
          title: bankName,
          locator: 'fixture',
          license: 'project-authored',
          retrieved_at: new Date().toISOString(),
        },
      ],
      assets: [
        asset('structure', 'M 12 11 L 90 90'),
        asset('map', 'M 90 11 L 12 90'),
      ],
      questions: [
        {
          ...common,
          external_id: 'name',
          type: 'name_from_structure',
          stem: 'Name the example compound',
          asset_refs: ['structure'],
          accepted_answers: ['propan-2-one', 'acetone'],
          visual: { type: 'name_from_structure', smiles: 'CC(=O)C' },
        },
        {
          ...common,
          external_id: 'spot',
          type: 'image_hotspot',
          stem: 'Select the first region of the exercise',
          asset_refs: ['map'],
          visual: {
            type: 'image_hotspot',
            hotspot: {
              mode: 'click',
              correct_region: 'first',
              regions: [
                {
                  id: 'first',
                  label: 'First region',
                  points: [
                    [0, 0],
                    [0.4, 0],
                    [0.4, 0.4],
                    [0, 0.4],
                  ],
                },
                {
                  id: 'second',
                  label: 'Second region',
                  points: [
                    [0.6, 0.6],
                    [1, 0.6],
                    [1, 1],
                    [0.6, 1],
                  ],
                },
              ],
            },
          },
        },
      ],
    },
  })
  expect(created.ok()).toBe(true)
  const sources = await (await page.request.get('/api/v1/admin/sources')).json()
  const source = sources.items.find(
    (record: { title: string }) => record.title === bankName,
  )
  expect(
    (
      await page.request.patch('/api/v1/admin/sources', {
        headers,
        data: { id: source.id, review_status: 'approved' },
      })
    ).ok(),
  ).toBe(true)
  const bank = await (
    await page.request.get('/api/v1/admin/questions?subject=' + subject)
  ).json()
  expect(bank.items).toHaveLength(2)
  for (const q of bank.items) {
    const path = '/api/v1/admin/questions/' + q.id
    const verified = await page.request.patch(path, {
      headers,
      data: { expected_version: q.version, status: 'verified' },
    })
    expect(verified.ok()).toBe(true)
    expect(
      (
        await page.request.patch(path, {
          headers,
          data: {
            expected_version: (await verified.json()).version,
            status: 'approved',
          },
        })
      ).ok(),
    ).toBe(true)
  }
  expect(
    (
      await page.request.patch('/api/v1/admin/sources', {
        headers,
        data: {
          id: source.id,
          audience: 'public',
          expected_audience: 'owner_only',
          rights_basis: 'Project-authored synthetic test fixture',
        },
      })
    ).ok(),
  ).toBe(true)
  await page.context().clearCookies()
  await signInAs(page, `visual-learner-${crypto.randomUUID()}@example.invalid`)

  const start = async (type: string) => {
    await page.goto('/')
    await page.getByRole('button', { name: new RegExp(bankName) }).click()
    await page.getByLabel('Loại câu').selectOption(type)
    await page.getByRole('button', { name: 'Bắt đầu luyện →' }).click()
  }
  await start('name_from_structure')
  await expect(page.getByAltText('Sơ đồ liên kết của hợp chất')).toBeVisible()
  await page.getByLabel('Tên hợp chất').fill(' ACETONE ')
  await expect(page.getByText('Đã làm', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xem kết quả bài luyện' }).click()
  await expect(
    page.getByRole('heading', { name: /Đáp án: propan-2-one/ }),
  ).toBeVisible()
  await start('image_hotspot')
  const select = page.getByRole('combobox', {
    name: 'Bộ phận trên hình',
    exact: true,
  })
  await expect(select).toBeEnabled()
  await page
    .getByRole('button', { name: 'Chọn điểm trên hình', exact: true })
    .press('Enter')
  await expect(select).toBeFocused()
  await select.press('ArrowDown')
  await expect(select).toHaveValue('first')
  await expect(page.getByText('Đã làm', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Xem kết quả bài luyện' }).click()
  await expect(
    page.getByRole('heading', { name: /Đáp án: First region/ }),
  ).toBeVisible()
})
