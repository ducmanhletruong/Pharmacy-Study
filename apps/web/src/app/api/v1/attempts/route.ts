import { createAttemptSchema } from '@pharmacy/api-contract'
import { createAttempt, PracticeError } from '@pharmacy/db/practice'
import { body, handle } from '../../../../server/http'
export function POST(request: Request) {
  return handle(request, async (actor, requestId) => {
    const key = request.headers.get('Idempotency-Key')
    if (!key || key.length > 128)
      throw new PracticeError(
        'validation_failed',
        400,
        'Cần Idempotency-Key dài tối đa 128 ký tự',
      )
    const input = createAttemptSchema.parse(await body(request))
    const result = await createAttempt(input, key, actor.id, requestId)
    return Response.json(result.attempt, {
      status: result.replayed ? 200 : 201,
      headers: result.replayed ? { 'Idempotent-Replay': 'true' } : {},
    })
  })
}
