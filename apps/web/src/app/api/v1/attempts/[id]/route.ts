import { uuid } from '@pharmacy/api-contract'
import { getAttempt } from '@pharmacy/db/practice'
import { handle } from '../../../../../server/http'
import { assertAttemptAccess } from '../../../../../server/permissions'
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(request, async (actor) => {
    const id = uuid.parse((await context.params).id)
    await assertAttemptAccess(actor, id, 'attempt:read')
    return Response.json(
      await getAttempt(id, actor.id, undefined, actor.role === 'admin'),
    )
  })
}
