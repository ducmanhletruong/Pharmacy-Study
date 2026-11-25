import { subjects } from '@pharmacy/db/practice'
import { handle } from '../../../../server/http'
export function GET(request: Request) {
  return handle(request, async (actor) =>
    Response.json(await subjects(actor.id, actor.role === 'admin')),
  )
}
