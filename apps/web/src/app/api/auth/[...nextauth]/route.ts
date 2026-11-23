import { randomUUID } from 'node:crypto'
import NextAuth from 'next-auth'
import { getToken } from 'next-auth/jwt'
import { rateClient } from '../../../../server/auth/rate-client'
import { NextRequest } from 'next/server'
import { authOptions } from '../../../../server/auth/options'
import { readAuthConfig } from '../../../../config'
import { assertHost, assertOrigin } from '../../../../server/security/origin'
import { readBody } from '../../../../server/security/body'
import { takeRateLimit } from '@pharmacy/db/limits'
import { PracticeError } from '@pharmacy/db/practice'

type Context = { params: Promise<{ nextauth: string[] }> }
async function handler(request: NextRequest, context: Context) {
  const requestId = randomUUID()
  let clientCookie: string | null = null
  const finish = (response: Response) => {
    if (clientCookie) response.headers.append('Set-Cookie', clientCookie)
    response.headers.set('Cache-Control', 'no-store')
    return response
  }
  try {
    const config = readAuthConfig()
    if (!['oidc', 'test', 'guest'].includes(config.AUTH_MODE))
      return Response.json(
        { error: 'Đăng nhập chưa sẵn sàng' },
        { status: 503 },
      )
    assertHost(request)
    if (request.method === 'POST') assertOrigin(request)
    const action = (await context.params).nextauth[0]
    // Reject oversized bodies before charging any shared anonymous budget.
    let incoming = request
    if (request.method === 'POST')
      incoming = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: await readBody(request),
      })
    const client = rateClient(
      request,
      config.NEXTAUTH_SECRET!,
      config.NODE_ENV === 'production' ||
        config.NEXTAUTH_URL!.startsWith('https://'),
    )
    clientCookie = client.cookie
    if (request.method === 'POST' || action === 'callback') {
      const token =
        action === 'signout'
          ? await getToken({ req: request, secret: config.NEXTAUTH_SECRET })
          : null
      const sessionId = typeof token?.sid === 'string' ? token.sid : null
      const bucket = sessionId
        ? `auth:logout:${sessionId}`
        : `auth:client:${client.key}`
      const global = sessionId
        ? { allowed: true, retryAfter: 0 }
        : await takeRateLimit('auth:global', config.RATE_LIMIT_AUTH_GLOBAL)
      const budget = global.allowed
        ? await takeRateLimit(bucket, config.RATE_LIMIT_AUTH)
        : { allowed: false, retryAfter: global.retryAfter }
      if (!budget.allowed || !global.allowed)
        return finish(
          Response.json(
            { error: 'Thử lại sau ít phút' },
            {
              status: 429,
              headers: {
                'Retry-After': String(
                  Math.max(budget.retryAfter, global.retryAfter),
                ),
              },
            },
          ),
        )
    }
    const options = authOptions(requestId)
    const onSignOut = options.events!.signOut!
    let revokeFailed = false
    options.events = {
      ...options.events,
      async signOut(message) {
        try {
          await onSignOut(message)
        } catch (error) {
          revokeFailed = true
          throw error
        }
      },
    }
    const response = await NextAuth(options)(incoming, context)
    // NextAuth swallows event failures. Discard its cookie-clearing/redirect
    // response when our durable revoke failed; the caller can safely retry.
    if (revokeFailed)
      throw new PracticeError(
        'logout_unavailable',
        503,
        'Chưa thể thu hồi phiên. Vui lòng thử đăng xuất lại.',
      )
    return finish(response)
  } catch (error) {
    const known = error instanceof PracticeError
    console.warn(
      JSON.stringify({
        event: 'auth.request_denied',
        requestId,
        code: known ? error.code : 'auth_error',
      }),
    )
    return finish(
      Response.json(
        {
          error: known
            ? error.message
            : 'Không thể đăng nhập. Vui lòng liên hệ quản trị viên.',
        },
        {
          status: known ? error.status : 500,
          headers: { 'Cache-Control': 'no-store' },
        },
      ),
    )
  }
}
export const GET = handler
export const POST = handler
