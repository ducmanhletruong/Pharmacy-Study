import { expect, test } from '@playwright/test'
import { signInAs } from './sign-in'

test('all topic depths keep their labels and submit the selected topic ID', async ({
  page,
}) => {
  await signInAs(page)
  const ids = [1, 2, 3, 4, 5].map(
    (number) => `71000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
  )
  await page.route('**/api/v1/subjects/synthetic/topics', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: ids[0],
            title: 'Gốc',
            children: [
              {
                id: ids[1],
                title: 'Nhánh',
                children: [
                  {
                    id: ids[2],
                    title: 'Mục',
                    children: [{ id: ids[3], title: 'Lá', children: [] }],
                  },
                ],
              },
            ],
          },
          { id: ids[4], title: 'Gốc khác', children: [] },
        ],
      },
    }),
  )
  let posted: unknown
  const attemptId = '71000000-0000-4000-8000-000000000006'
  await page.route('**/api/v1/attempts', async (route) => {
    posted = route.request().postDataJSON()
    await route.fulfill({
      status: 201,
      json: {
        id: attemptId,
        subject: 'synthetic',
        mode: 'practice',
        status: 'in_progress',
        items: [
          {
            position: 1,
            question_id: '71000000-0000-4000-8000-000000000007',
            revision_id: '71000000-0000-4000-8000-000000000008',
            stem: 'Synthetic topic-depth question',
            choices: ['A', 'B', 'C', 'D'].map((label) => ({
              label,
              text: `Choice ${label}`,
            })),
            answer: null,
            flagged: false,
          },
        ],
      },
    })
  })
  await page.getByRole('button', { name: /Môn mẫu tổng hợp/ }).click()
  const topics = page.getByRole('combobox', { name: 'Chủ đề', exact: true })
  await expect(topics.locator('option')).toHaveText([
    'Tất cả chủ đề',
    'Gốc',
    '— Nhánh',
    '— — Mục',
    '— — — Lá',
    'Gốc khác',
  ])
  await expect(topics.locator('optgroup')).toHaveCount(0)
  expect(
    await topics
      .locator('option')
      .evaluateAll((options) =>
        options.map((option) => (option as HTMLOptionElement).value),
      ),
  ).toEqual(['', ...ids])
  await topics.selectOption(ids[3]!)
  await page.getByRole('button', { name: 'Bắt đầu luyện →' }).click()
  await expect(page).toHaveURL(new RegExp(`attempt=${attemptId}$`))
  expect(posted).toMatchObject({ subject: 'synthetic', topic_ids: [ids[3]] })
  await expect(page.getByText('Synthetic topic-depth question')).toBeVisible()
})
