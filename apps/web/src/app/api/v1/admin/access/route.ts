import { handle } from '../../../../../server/http'
export function GET(request: Request) {
  return handle(
    request,
    async (actor) => Response.json({ role: actor.role }),
    'admin:access',
  )
}
