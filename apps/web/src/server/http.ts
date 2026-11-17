import { randomUUID } from 'node:crypto'
import { ZodError } from '@pharmacy/api-contract'
import { PracticeError } from '@pharmacy/db/practice'
import { getPool } from '@pharmacy/db'
import { appendAudit } from '@pharmacy/db/audit'
import { takeRateLimit } from '@pharmacy/db/limits'
import { authorize, type Action } from '@pharmacy/core/authz'
import type { Member } from '@pharmacy/db/auth'
import { readAuthConfig } from '../config'
import { currentActor } from './auth/actor'
import { assertHost, assertOrigin } from './security/origin'
import { readBody } from './security/body'

export async function handle(
  request: Request,
  run: (actor: Member, requestId: string) => Promise<Response>,
  action: Action = 'practice:use',
) {
  const requestId = randomUUID()
  let actor: Member | null = null
  try {
    const config = readAuthConfig()
    assertHost(request)
    actor = await currentActor(requestId)
    if (!actor)
      throw new PracticeError('unauthenticated', 401, 'Vui lòng đăng nhập')
    if (!authorize(actor, action))
      throw new PracticeError('forbidden', 403, 'Bạn không có quyền truy cập')
    if (!['GET', 'HEAD'].includes(request.method)) {
      assertOrigin(request)
      if (Number(request.headers.get('content-length') ?? 0) > 16384)
        throw new PracticeError('payload_too_large', 413, 'Nội dung quá lớn')
      const path = new URL(request.url).pathname
      const kind =
        request.method === 'PUT'
          ? 'item'
          : path.endsWith('/submit')
            ? 'submit'
            : 'create'
      const limit =
        kind === 'item'
          ? config.RATE_LIMIT_ITEM_WRITE
          : config.RATE_LIMIT_ATTEMPT_CREATE
      const budget = await takeRateLimit(`api:${actor.id}:${kind}`, limit)
      if (!budget.allowed) {
        const error = new PracticeError(
          'rate_limited',
          429,
          'Bạn thao tác quá nhanh. Vui lòng thử lại sau.',
        )
        error.retryAfter = budget.retryAfter
        throw error
      }
    }
    const response = await run(actor, requestId)
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('X-Request-Id', requestId)
    return response
  } catch (error) {
    const known = error instanceof PracticeError,
      validation = error instanceof ZodError || error instanceof SyntaxError
    const status = known ? error.status : validation ? 400 : 500
    const code = known
      ? error.code
      : validation
        ? 'validation_failed'
        : 'internal_error'
    const message = known
      ? error.message
      : validation
        ? 'Dữ liệu không hợp lệ'
        : 'Không thể xử lý yêu cầu'
    if ([401, 403, 404, 429].includes(status)) {
      try {
        await appendAudit(getPool(), {
          actorId: actor?.id ?? null,
          action: 'security.denied',
          entityType: 'request',
          details: { reason: code },
          requestId,
        })
      } catch {
        console.warn(JSON.stringify({ event: 'audit.write_failed', requestId }))
      }
    }
    console.info(
      JSON.stringify({
        event: 'api.error',
        requestId,
        userId: actor?.id ?? null,
        code,
        status,
      }),
    )
    return Response.json(
      { error: { code, message, details: null, requestId } },
      {
        status,
        headers: {
          'Cache-Control': 'no-store',
          'X-Request-Id': requestId,
          ...(known && error.retryAfter
            ? { 'Retry-After': String(error.retryAfter) }
            : {}),
        },
      },
    )
  }
}
export async function body(request: Request) {
  return JSON.parse(await readBody(request))
}
