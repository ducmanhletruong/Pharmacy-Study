import { uuid } from '@pharmacy/api-contract'
import { submitAttempt } from '@pharmacy/db/practice'
import { handle } from '../../../../../../server/http'
import { assertAttemptAccess } from '../../../../../../server/permissions'
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(request, async (actor, requestId) => {
    const id = uuid.parse((await context.params).id)
    await assertAttemptAccess(actor, id, 'attempt:submit')
    return Response.json(await submitAttempt(id, actor.id, requestId))
  })
}
