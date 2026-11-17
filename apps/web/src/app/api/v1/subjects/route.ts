import { subjects } from '@pharmacy/db/practice'
import { handle } from '../../../../server/http'
export function GET(request: Request) {
  return handle(request, async () => Response.json(await subjects()))
}
