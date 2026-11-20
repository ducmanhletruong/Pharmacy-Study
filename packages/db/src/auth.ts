import { randomUUID } from 'node:crypto'
import { uuid } from '@pharmacy/api-contract'
import type { Actor, Role } from '@pharmacy/core/authz'
import { getPool } from './client'
import { appendAudit } from './audit'

export type Member = Actor & { email: string; name: string }
type UserRow = {
  id: string
  email: string
  display_name: string
  role: Role
  status: 'active' | 'disabled'
}
export async function registerIdentity(input: {
  provider: 'google' | 'test' | 'guest'
  subject: string
  email: string
  name: string
  role: Role
}): Promise<Member | null> {
  if (
    input.provider === 'guest' &&
    (!uuid.safeParse(input.subject).success ||
      input.email !== `${input.subject}@guest.invalid`)
  )
    return null
  const role = input.provider === 'guest' ? 'learner' : input.role
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `identity:${input.email}`,
    ])
    const identity = await client.query<UserRow>(
      'SELECT u.* FROM users u JOIN auth_identities a ON a.user_id=u.id WHERE a.provider=$1 AND a.provider_subject=$2',
      [input.provider, input.subject],
    )
    let user = identity.rows[0]
    if (
      user &&
      (user.email.toLowerCase() !== input.email || user.status !== 'active')
    ) {
      await client.query('ROLLBACK')
      return null
    }
    if (!user) {
      const prior = await client.query<UserRow>(
        'SELECT * FROM users WHERE email=$1 FOR UPDATE',
        [input.email],
      )
      if (prior.rows[0]) {
        const bindings = await client.query(
          'SELECT 1 FROM auth_identities WHERE user_id=$1',
          [prior.rows[0].id],
        )
        if (bindings.rowCount || prior.rows[0].status !== 'active') {
          await client.query('ROLLBACK')
          return null
        }
        user = prior.rows[0]
      } else {
        const created = await client.query<UserRow>(
          'INSERT INTO users(email,display_name,role) VALUES($1,$2,$3) RETURNING *',
          [input.email, input.name.slice(0, 200), role],
        )
        user = created.rows[0]!
      }
      await client.query(
        'INSERT INTO auth_identities(provider,provider_subject,user_id) VALUES($1,$2,$3)',
        [input.provider, input.subject, user.id],
      )
    }
    await client.query(
      'UPDATE users SET display_name=$2,role=$3,last_login_at=now() WHERE id=$1',
      [user.id, input.name.slice(0, 200), role],
    )
    await client.query('COMMIT')
    return {
      id: user.id,
      email: input.email,
      name: input.name.slice(0, 200),
      role,
      status: 'active',
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
export async function createSession(
  userId: string,
  provider: string,
  requestId: string,
) {
  const client = await getPool().connect()
  const sid = randomUUID()
  try {
    await client.query('BEGIN')
    const active = await client.query(
      "SELECT 1 FROM users WHERE id=$1 AND status='active'",
      [userId],
    )
    if (!active.rowCount) throw new Error('Account unavailable')
    await client.query(
      "INSERT INTO auth_sessions(id,user_id,expires_at) VALUES($1,$2,now()+interval '8 hours')",
      [sid, userId],
    )
    await appendAudit(client, {
      actorId: userId,
      action: 'auth.sign_in',
      entityType: 'auth_session',
      entityId: sid,
      details: { provider },
      requestId,
    })
    await client.query('COMMIT')
    return sid
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
export async function sessionMember(
  id: string,
  sid: string,
): Promise<Member | null> {
  const result = await getPool().query<UserRow>(
    "SELECT u.* FROM users u JOIN auth_sessions s ON s.user_id=u.id WHERE u.id=$1 AND s.id=$2 AND u.status='active' AND s.revoked_at IS NULL AND s.expires_at>now()",
    [id, sid],
  )
  const user = result.rows[0]
  return user
    ? {
        id: user.id,
        email: user.email.toLowerCase(),
        name: user.display_name,
        role: user.role,
        status: user.status,
      }
    : null
}
export async function revokeSession(
  id: string,
  sid: string,
  requestId: string,
) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const changed = await client.query(
      'UPDATE auth_sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id',
      [sid, id],
    )
    if (changed.rowCount)
      await appendAudit(client, {
        actorId: id,
        action: 'auth.sign_out',
        entityType: 'auth_session',
        entityId: sid,
        requestId,
      })
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
