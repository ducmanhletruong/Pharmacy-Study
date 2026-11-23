import { topics } from '@pharmacy/db/practice'
import { handle } from '../../../../../../server/http'
export function GET(
  request: Request,
  context: { params: Promise<{ code: string }> },
) {
  return handle(request, async () =>
    Response.json(await topics((await context.params).code)),
  )
}
