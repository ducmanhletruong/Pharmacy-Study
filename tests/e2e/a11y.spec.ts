import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { expect, test, type Page } from '@playwright/test'
import { admin } from './fixtures'
import { signInAs } from './sign-in'

const axePath = process.env.AXE_CORE_SCRIPT
test.skip(
  !axePath,
  'Set AXE_CORE_SCRIPT to the verified axe-core 4.10.3 bundle',
)
test.use({ bypassCSP: true })

let axeSource: string
test.beforeAll(async () => {
  const bundle = await readFile(axePath!)
  expect(createHash('sha256').update(bundle).digest('hex')).toBe(
    '880970c081707360e64f34cea25ff91892f5bc95675b0776925b9709dd8a68bb',
  )
  axeSource = bundle.toString('utf8')
})

async function auditPage(page: Page, path: string) {
  await page.goto(path)
  await expect(page).toHaveURL(new URL(path, page.url()).href)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.addScriptTag({ content: axeSource })
  const violations = await page.evaluate(async () => {
    type Violation = {
      id: string
      impact: string
      nodes: { target: string[] }[]
    }
    const axe = (
      window as Window & {
        axe?: {
          run(): Promise<{ violations: Violation[] }>
        }
      }
    ).axe
    if (!axe) throw Error('axe did not initialize')
    const report = await axe.run()
    return report.violations
      .filter(({ impact }) => impact === 'serious' || impact === 'critical')
      .map(({ id, impact, nodes }) => ({
        id,
        impact,
        targets: nodes.map(({ target }) => target),
      }))
  })
  expect.soft(violations, `Accessibility violations on ${path}`).toEqual([])
}

test('login, practice, timed study and written exams pass axe', async ({
  page,
}) => {
  test.setTimeout(60000)
  await auditPage(page, '/login')
  await signInAs(page)
  for (const path of ['/', '/study', '/written']) await auditPage(page, path)
})

test('the admin workspace passes axe', async ({ page }) => {
  await signInAs(page, admin)
  await auditPage(page, '/admin')
})
