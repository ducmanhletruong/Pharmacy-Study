import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
const state = vi.hoisted(() => ({
  actor: {
    id: '00000000-0000-4000-8000-000000000001',
    role: 'admin',
    status: 'active',
  } as { id: string; role: 'admin' | 'learner'; status: 'active' } | null,
  importBundle: vi.fn(),
  patchQuestion: vi.fn(),
}))
vi.mock('../auth/actor', () => ({ currentActor: async () => state.actor }))
vi.mock('@pharmacy/db', () => ({ getPool: () => ({}), getDb: vi.fn() }))
vi.mock('@pharmacy/db/audit', () => ({ appendAudit: async () => {} }))
vi.mock('@pharmacy/db/limits', () => ({
  takeRateLimit: async () => ({ allowed: true, retryAfter: 0 }),
}))
vi.mock('@pharmacy/db/content', () => ({
  importBundle: state.importBundle,
  patchQuestion: state.patchQuestion,
  getImport: vi.fn(),
  listQuestions: vi.fn(),
  questionDetail: vi.fn(),
  listSources: vi.fn(),
  reviewSource: vi.fn(),
  createReport: vi.fn(),
  listReports: vi.fn(),
  resolveReport: vi.fn(),
  getAsset: vi.fn(),
}))
import {
  importsPOST,
  questionsGET,
  questionPATCH,
  sourcesGET,
  reportsGET,
  importGET,
  assetGET,
} from './routes'
import { PracticeError } from '@pharmacy/db/practice'
const fixture = JSON.parse(
  readFileSync(
    new URL('../../../../../content/fixtures/p04-bundle.json', import.meta.url),
    'utf8',
  ),
)
const origin = 'http://localhost:3000'
const context = {
  params: Promise.resolve({ id: '00000000-0000-4000-8000-000000000002' }),
}
function request(path: string, method = 'GET', data?: unknown) {
  return new Request(origin + '/api/v1' + path, {
    method,
    headers: {
      Host: 'localhost:3000',
      Origin: origin,
      'Content-Type': 'application/json',
    },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  })
}
beforeEach(() => {
  vi.stubEnv('AUTH_MODE', 'disabled')
  vi.stubEnv('APP_ORIGIN', origin)
  state.actor = {
    id: '00000000-0000-4000-8000-000000000001',
    role: 'admin',
    status: 'active',
  }
  state.importBundle.mockReset().mockResolvedValue({
    import_id: 'synthetic',
    status: 'imported',
    counts: { created: 1, duplicates: 0 },
    report: { near_duplicates: [] },
  })
  state.patchQuestion.mockReset()
})
afterEach(() => vi.unstubAllEnvs())
test('learner cannot access administration and unauthenticated asset reads fail closed', async () => {
  state.actor!.role = 'learner'
  for (const response of [
    await importsPOST(request('/admin/imports', 'POST', fixture)),
    await questionsGET(request('/admin/questions')),
    await sourcesGET(request('/admin/sources')),
    await reportsGET(request('/admin/reports')),
    await importGET(request('/admin/imports/x'), context),
  ])
    expect(response.status).toBe(403)
  expect(state.importBundle).not.toHaveBeenCalled()
  state.actor = null
  expect((await assetGET(request('/assets/x'), context)).status).toBe(401)
})
test('bounded JSON and multipart bundles share validation and unknown schema fails as 422', async () => {
  expect(
    (await importsPOST(request('/admin/imports', 'POST', fixture))).status,
  ).toBe(201)
  const form = new FormData()
  form.append(
    'bundle',
    new Blob([JSON.stringify(fixture)], { type: 'application/json' }),
    '../ignored-name.json',
  )
  const uploaded = new Request(origin + '/api/v1/admin/imports', {
    method: 'POST',
    headers: { Host: 'localhost:3000', Origin: origin },
    body: form,
  })
  expect((await importsPOST(uploaded)).status).toBe(201)
  expect(state.importBundle).toHaveBeenCalledTimes(2)
  expect(
    (
      await importsPOST(
        request('/admin/imports', 'POST', { ...fixture, untrusted: true }),
      )
    ).status,
  ).toBe(422)
})
test('import size and Origin are enforced before service writes', async () => {
  vi.stubEnv('MAX_IMPORT_BYTES', '1024')
  const large = new Request(origin + '/api/v1/admin/imports', {
    method: 'POST',
    headers: {
      Host: 'localhost:3000',
      Origin: origin,
      'Content-Type': 'application/json',
      'Content-Length': '2048',
    },
    body: 'x'.repeat(2048),
  })
  expect((await importsPOST(large)).status).toBe(413)
  for (const claimedLength of [undefined, '10']) {
    const streamed = new Request(origin + '/api/v1/admin/imports', {
      method: 'POST',
      headers: {
        Host: 'localhost:3000',
        Origin: origin,
        'Content-Type': 'application/json',
        ...(claimedLength ? { 'Content-Length': claimedLength } : {}),
      },
      body: 'x'.repeat(2048),
    })
    expect((await importsPOST(streamed)).status).toBe(413)
  }
  const foreign = new Request(origin + '/api/v1/admin/imports', {
    method: 'POST',
    headers: {
      Host: 'localhost:3000',
      Origin: 'https://attacker.invalid',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(fixture),
  })
  expect((await importsPOST(foreign)).status).toBe(403)
  expect(state.importBundle).not.toHaveBeenCalled()
})
test('patch requires a version and service conflicts preserve the 409 contract', async () => {
  expect(
    (
      await questionPATCH(
        request('/admin/questions/x', 'PATCH', { status: 'verified' }),
        context,
      )
    ).status,
  ).toBe(400)
  state.patchQuestion.mockRejectedValueOnce(
    new PracticeError('version_conflict', 409, 'Câu hỏi đã thay đổi'),
  )
  expect(
    (
      await questionPATCH(
        request('/admin/questions/x', 'PATCH', {
          expected_version: 1,
          status: 'verified',
        }),
        context,
      )
    ).status,
  ).toBe(409)
})
