import { PracticeError } from '@pharmacy/db/practice'
export function assertHost(request: Request) {
  const target = new URL(request.url)
  target.host = request.headers.get('host') ?? target.host
  const configured =
    process.env.APP_ORIGIN ??
    (process.env.AUTH_MODE === 'oidc' || process.env.AUTH_MODE === 'test'
      ? process.env.NEXTAUTH_URL
      : undefined)
  const expected = configured ? new URL(configured).origin : target.origin
  if (
    configured
      ? target.host !== new URL(configured).host
      : !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  )
    throw new PracticeError('forbidden', 403, 'Địa chỉ truy cập không hợp lệ')
  return expected
}
export function assertOrigin(request: Request) {
  const expected = assertHost(request)
  if (request.headers.get('origin') !== expected)
    throw new PracticeError('forbidden', 403, 'Origin không hợp lệ')
}
