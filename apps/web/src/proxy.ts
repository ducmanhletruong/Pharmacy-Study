import { NextResponse, type NextRequest } from 'next/server'
import { securityHeaders } from './server/security/headers'

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const secure = securityHeaders(nonce)
  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('Content-Security-Policy', secure.get('Content-Security-Policy')!)
  const response = NextResponse.next({ request: { headers } })
  secure.forEach((value, key) => response.headers.set(key, value))
  response.headers.set('Cache-Control', 'no-store')
  return response
}
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
