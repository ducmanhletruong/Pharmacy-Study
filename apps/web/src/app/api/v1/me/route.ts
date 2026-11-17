import { handle } from '../../../../server/http'
export function GET(request: Request) {
  return handle(request, async (actor) =>
    Response.json({
      id: actor.id,
      name: actor.name,
      email: actor.email,
      role: actor.role,
    }),
  )
}
