import { authorize, type Actor, type Action } from '@pharmacy/core/authz'
import { getPool } from '@pharmacy/db'
import { PracticeError } from '@pharmacy/db/practice'

export async function assertAttemptAccess(
  actor: Actor,
  id: string,
  action: Action,
) {
  const result = await getPool().query<{ user_id: string }>(
    'SELECT user_id FROM attempts WHERE id=$1 AND user_id=$2',
    [id, actor.id],
  )
  const row = result.rows[0]
  if (!row || !authorize(actor, action, row))
    throw new PracticeError('not_found', 404, 'Không tìm thấy bài làm')
}
