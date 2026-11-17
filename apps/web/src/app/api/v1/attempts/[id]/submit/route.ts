import { uuid } from '@pharmacy/api-contract'
import { submitAttempt } from '@pharmacy/db/practice'
import { handle } from '../../../../../../server/http'
export function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(request, async (userId) =>
    Response.json(
      await submitAttempt(uuid.parse((await context.params).id), userId),
    ),
  )
}
