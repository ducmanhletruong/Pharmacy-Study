import { randomUUID } from 'node:crypto'
import NextAuth from 'next-auth'
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
  try {
    const config = readAuthConfig()
    if (config.AUTH_MODE !== 'oidc' && config.AUTH_MODE !== 'test')
      return Response.json(
        { error: 'Đăng nhập chưa sẵn sàng' },
        { status: 503 },
      )
    assertHost(request)
    if (request.method === 'POST') assertOrigin(request)
    if (
      request.method === 'POST' ||
      new URL(request.url).pathname.includes('/callback/')
    ) {
      const budget = await takeRateLimit(
        'auth:anonymous',
        config.RATE_LIMIT_AUTH,
      )
      if (!budget.allowed)
        return Response.json(
          { error: 'Thử lại sau ít phút' },
          {
            status: 429,
            headers: { 'Retry-After': String(budget.retryAfter) },
          },
        )
    }
    let incoming = request
    if (request.method === 'POST')
      incoming = new NextRequest(request.url, {
        method: 'POST',
        headers: request.headers,
        body: await readBody(request),
      })
    return await NextAuth(authOptions(requestId))(incoming, context)
  } catch (error) {
    const known = error instanceof PracticeError
    console.warn(
      JSON.stringify({
        event: 'auth.request_denied',
        requestId,
        code: known ? error.code : 'auth_error',
      }),
    )
    return Response.json(
      {
        error: known
          ? error.message
          : 'Không thể đăng nhập. Vui lòng liên hệ quản trị viên.',
      },
      {
        status: known ? error.status : 500,
        headers: { 'Cache-Control': 'no-store' },
      },
    )
  }
}
export const GET = handler
export const POST = handler
