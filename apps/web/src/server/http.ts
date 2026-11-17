import { randomUUID } from 'node:crypto'
import { ZodError } from '@pharmacy/api-contract'
import { PracticeError } from '@pharmacy/db/practice'
import { DEV_USER_ID } from '@pharmacy/db'
import { assertAuthMode } from '../config'

export async function handle(
  request: Request,
  run: (userId: string) => Promise<Response>,
) {
  const requestId = randomUUID()
  try {
    assertAuthMode()
    if (process.env.AUTH_MODE !== 'dev')
      throw new PracticeError(
        'unauthenticated',
        401,
        'Chế độ luyện mẫu chưa được bật',
      )
    if (!['GET', 'HEAD'].includes(request.method)) {
      const target = new URL(request.url)
      // Next dev normalizes request.url to its bind address. Host retains the
      // browser's actual destination; never trust forwarded headers here.
      target.host = request.headers.get('host') ?? target.host
      const expected = process.env.APP_ORIGIN ?? target.origin
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(
        target.hostname,
      )
      if (
        request.headers.get('origin') !== expected ||
        (!process.env.APP_ORIGIN && !local)
      )
        throw new PracticeError('forbidden', 403, 'Origin không hợp lệ')
      if (Number(request.headers.get('content-length') ?? 0) > 16384)
        throw new PracticeError('payload_too_large', 413, 'Nội dung quá lớn')
    }
    const response = await run(DEV_USER_ID)
    response.headers.set('Cache-Control', 'no-store')
    response.headers.set('X-Request-Id', requestId)
    return response
  } catch (error) {
    const known = error instanceof PracticeError
    const validation = error instanceof ZodError || error instanceof SyntaxError
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
    // Never serialize database errors, SQL or credentials into API responses.
    return Response.json(
      { error: { code, message, details: null, requestId } },
      { status, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
export async function body(request: Request) {
  const text = await request.text()
  if (Buffer.byteLength(text) > 16384)
    throw new PracticeError('payload_too_large', 413, 'Nội dung quá lớn')
  return JSON.parse(text)
}
