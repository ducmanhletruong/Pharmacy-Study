import { uuid } from '@pharmacy/api-contract'
import { getAttempt } from '@pharmacy/db/practice'
import { handle } from '../../../../../server/http'
export function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(request, async (userId) =>
    Response.json(
      await getAttempt(uuid.parse((await context.params).id), userId),
    ),
  )
}
