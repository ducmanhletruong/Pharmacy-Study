import { rejects } from 'node:assert/strict'
import { test } from 'node:test'
import { checkRelease } from './release.mjs'

const origin = 'https://release.example.invalid'
const cache = { 'cache-control': 'private, no-store' }
const headers = {
  ...cache,
  'content-type': 'text/html',
  'content-security-policy':
    "script-src 'self' 'nonce-fixture' 'strict-dynamic'",
  'strict-transport-security': 'max-age=31536000',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
}

function responses(overrides = {}) {
  return async (url, request) => {
    if (request.redirect !== 'manual') throw Error('Redirects must be disabled')
    return (
      overrides[url.pathname] ??
      (url.pathname === '/login'
        ? new Response('<html lang="vi"></html>', { headers })
        : Response.json(
            url.pathname === '/api/v1/health'
              ? { status: 'ok' }
              : url.pathname === '/api/v1/health/ready'
                ? { status: 'ready' }
                : { guest: {}, google: {} },
            { headers: cache },
          ))
    )
  }
}

test('passes protected production endpoints over an approved origin', async () => {
  await checkRelease(origin, { auth: 'oidc', transport: responses() })
  await checkRelease('http://127.0.0.1:3000', {
    local: true,
    transport: responses(),
  })
})

test('fails if the deployment switched to the wrong auth mode', async () => {
  await rejects(
    checkRelease(origin, { auth: 'guest', transport: responses() }),
    /do not match/,
  )
})

test('requires the expected artifact when a release ID is supplied', async () => {
  const releaseId = 'fixture.42'
  await checkRelease(origin, {
    releaseId,
    transport: responses({
      '/api/v1/health': Response.json(
        { status: 'ok', release_id: releaseId },
        { headers: cache },
      ),
    }),
  })
  for (const health of [
    { status: 'ok' },
    { status: 'ok', release_id: 'previous' },
  ])
    await rejects(
      checkRelease(origin, {
        releaseId,
        transport: responses({
          '/api/v1/health': Response.json(health, { headers: cache }),
        }),
      }),
      /does not match/,
    )
  await rejects(
    checkRelease(origin, { releaseId: '', transport: responses() }),
    /Invalid expected release ID/,
  )
})

test('rejects insecure origins, credentials and unapproved loopback mode', async () => {
  for (const [target, local] of [
    ['http://release.example.invalid', false],
    ['https://user:password@release.example.invalid', false],
    [origin, true],
  ])
    await rejects(
      checkRelease(target, { local, transport: responses() }),
      /origin/,
    )
})

test('fails on redirects, missing production headers or test authentication', async () => {
  for (const [path, response, error] of [
    ['/api/v1/health', Response.redirect(origin), /HTTP 302/],
    [
      '/api/v1/health/ready',
      Response.json({ status: 'unavailable' }, { status: 503, headers: cache }),
      /health\/ready.*HTTP 503/,
    ],
    [
      '/login',
      new Response('<html></html>', {
        headers: {
          ...headers,
          'content-security-policy': "script-src 'unsafe-eval'",
        },
      }),
      /production protections/,
    ],
    [
      '/api/auth/providers',
      Response.json({ guest: {}, test: {} }, { headers: cache }),
      /authentication providers/,
    ],
  ])
    await rejects(
      checkRelease(origin, { transport: responses({ [path]: response }) }),
      error,
    )
})
