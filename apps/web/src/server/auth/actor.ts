import { getServerSession } from 'next-auth'
import { getPool, DEV_USER_ID } from '@pharmacy/db'
import type { Member } from '@pharmacy/db/auth'
import { readAuthConfig } from '../../config'
import { authOptions } from './options'

export async function currentActor(requestId?: string): Promise<Member | null> {
  const config = readAuthConfig()
  if (config.AUTH_MODE === 'disabled') return null
  if (config.AUTH_MODE === 'dev') {
    const result = await getPool().query<{
      display_name: string
      email: string
    }>("SELECT display_name,email FROM users WHERE id=$1 AND status='active'", [
      DEV_USER_ID,
    ])
    const row = result.rows[0]
    return row
      ? {
          id: DEV_USER_ID,
          name: row.display_name,
          email: row.email,
          role: 'learner',
          status: 'active',
        }
      : null
  }
  const session = await getServerSession(authOptions(requestId))
  const user = session?.user
  return user
    ? {
        id: user.id,
        email: user.email!,
        name: user.name ?? '',
        role: user.role,
        status: 'active',
      }
    : null
}
