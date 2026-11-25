import { pathToFileURL } from 'node:url'

const loopback = new Set(['127.0.0.1', 'localhost', '[::1]'])

export async function checkRelease(
  target,
  { local = false, auth, releaseId, transport = fetch } = {},
) {
  const origin = new URL(target)
  if (
    origin.username ||
    origin.password ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash ||
    (local && !loopback.has(origin.hostname)) ||
    (origin.protocol !== 'https:' && !(local && origin.protocol === 'http:'))
  )
    throw Error('Expected an HTTPS origin or an explicit loopback rehearsal')
  if (auth !== undefined && !['guest', 'oidc'].includes(auth))
    throw Error('Expected authentication mode guest or oidc')
  if (
    releaseId !== undefined &&
    (typeof releaseId !== 'string' ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(releaseId))
  )
    throw Error('Invalid expected release ID')

  async function get(path, type) {
    let response
    try {
      response = await transport(new URL(path, origin), {
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
        headers: { Accept: type },
      })
    } catch {
      throw Error(`Request failed for ${path}`)
    }
    if (
      response.status !== 200 ||
      !response.headers.get('content-type')?.startsWith(type) ||
      !response.headers
        .get('cache-control')
        ?.split(',')
        .some((directive) => directive.trim().toLowerCase() === 'no-store')
    ) {
      await response.body?.cancel().catch(() => undefined)
      throw Error(
        `Invalid health or response headers for ${path} (HTTP ${response.status})`,
      )
    }
    return response
  }

  async function readJson(path) {
    const response = await get(path, 'application/json')
    try {
      return await response.json()
    } catch {
      throw Error(`Could not read JSON from ${path}`)
    }
  }

  const health = await readJson('/api/v1/health')
  if (health?.status !== 'ok') throw Error('Health response did not report ok')
  if (releaseId !== undefined && health.release_id !== releaseId)
    throw Error('Running artifact does not match the expected release ID')
  if ((await readJson('/api/v1/health/ready'))?.status !== 'ready')
    throw Error('Readiness response did not report ready')

  const login = await get('/login', 'text/html')
  await login.body?.cancel().catch(() => undefined)
  const csp = login.headers.get('content-security-policy') ?? ''
  const scriptPolicy = csp
    .split(';')
    .find((entry) => entry.trim().startsWith('script-src '))
  if (
    !scriptPolicy?.includes("'strict-dynamic'") ||
    !/'nonce-[^']+'/.test(scriptPolicy) ||
    /'unsafe-(eval|inline)'/.test(scriptPolicy) ||
    login.headers.get('x-content-type-options') !== 'nosniff' ||
    login.headers.get('x-frame-options') !== 'DENY' ||
    !/^max-age=[1-9]\d*(?:;|$)/i.test(
      login.headers.get('strict-transport-security') ?? '',
    )
  )
    throw Error('Missing production protections on the login page')

  const providers = await readJson('/api/auth/providers')
  if (
    !providers ||
    typeof providers !== 'object' ||
    Array.isArray(providers) ||
    !Object.hasOwn(providers, 'guest') ||
    Object.keys(providers).some(
      (provider) => !['guest', 'google'].includes(provider),
    )
  )
    throw Error('Unexpected authentication providers')
  if (auth && Object.hasOwn(providers, 'google') !== (auth === 'oidc'))
    throw Error(
      'Authentication providers do not match the release configuration',
    )
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [target, ...options] = process.argv.slice(2)
  try {
    const auth = options.filter((option) => option.startsWith('--auth='))
    const release = options.filter((option) => option.startsWith('--release='))
    const local = options.includes('--local')
    if (
      !target ||
      auth.length > 1 ||
      release.length > 1 ||
      options.length !== auth.length + release.length + Number(local)
    )
      throw Error(
        'Usage: node tests/smoke/release.mjs <app-origin> [--auth=guest|oidc] [--release=<id>] [--local]',
      )
    await checkRelease(target, {
      local,
      auth: auth[0]?.slice('--auth='.length),
      releaseId: release[0]?.slice('--release='.length),
    })
    console.log('Release smoke passed')
  } catch (error) {
    console.error(`Release smoke failed: ${error.message}`)
    process.exitCode = 1
  }
}
