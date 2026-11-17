import { answerSchema, uuid } from '@pharmacy/api-contract'
import { answerItem, PracticeError } from '@pharmacy/db/practice'
import { handle, body } from '../../../../../../../server/http'
export function PUT(
  request: Request,
  context: { params: Promise<{ id: string; position: string }> },
) {
  return handle(request, async (userId) => {
    const params = await context.params
    const position = Number(params.position)
    if (
      !/^\d+$/.test(params.position) ||
      !Number.isSafeInteger(position) ||
      position < 1
    )
      throw new PracticeError(
        'validation_failed',
        400,
        'Vị trí câu hỏi không hợp lệ',
      )
    const answer = answerSchema.parse(await body(request))
    return Response.json(
      await answerItem(
        uuid.parse(params.id),
        position,
        answer.answer,
        answer.flagged,
        userId,
      ),
    )
  })
}
