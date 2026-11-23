import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
const name = 'pharmacy-auth-client'
function signature(id: string, secret: string) {
  return createHmac('sha256', secret).update(`auth-client:${id}`).digest('hex')
}
export function rateClient(
  request: NextRequest,
  secret: string,
  secure: boolean,
) {
  const supplied = request.cookies.get(name)?.value ?? ''
  const [id, mac] = supplied.split('.')
  if (
    id &&
    /^[a-f0-9-]{36}$/.test(id) &&
    mac &&
    /^[a-f0-9]{64}$/.test(mac) &&
    timingSafeEqual(Buffer.from(mac), Buffer.from(signature(id, secret)))
  )
    return { key: id, cookie: null }
  const fresh = randomUUID(),
    value = `${fresh}.${signature(fresh, secret)}`
  return {
    key: fresh,
    cookie: `${name}=${value}; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=86400${secure ? '; Secure' : ''}`,
  }
}
