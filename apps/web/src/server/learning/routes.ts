import { z } from 'zod'
import { blueprintInputSchema, reviewInputSchema } from '@pharmacy/api-contract'
import { createAttempt, PracticeError } from '@pharmacy/db/practice'
import { listBlueprints, saveBlueprint, progress } from '@pharmacy/db/learning'
import { body, handle } from '../http'
const querySchema = z
  .object({
    subject: z.string().min(1).max(80).optional(),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
const query = (request: Request) =>
  querySchema.parse(Object.fromEntries(new URL(request.url).searchParams))
export function blueprintsGET(request: Request) {
  return handle(request, async () => {
    const q = query(request)
    return Response.json(
      await listBlueprints(q.subject, false, q.cursor, q.limit),
    )
  })
}
export function adminBlueprintsGET(request: Request) {
  return handle(
    request,
    async () => {
      const q = query(request)
      return Response.json(
        await listBlueprints(q.subject, true, q.cursor, q.limit),
      )
    },
    'content:manage',
  )
}
export function blueprintPOST(request: Request) {
  return handle(
    request,
    async (actor, requestId) => {
      const result = await saveBlueprint(
        blueprintInputSchema.parse(await body(request)),
        actor.id,
        requestId,
        undefined,
        request.headers.get('Idempotency-Key') ?? undefined,
      )
      return Response.json(result.item, {
        status: result.replayed ? 200 : 201,
        headers: result.replayed ? { 'Idempotent-Replay': 'true' } : {},
      })
    },
    'content:manage',
  )
}
export function blueprintPATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  return handle(
    request,
    async (actor, requestId) =>
      Response.json(
        (
          await saveBlueprint(
            blueprintInputSchema.parse(await body(request)),
            actor.id,
            requestId,
            z.uuid().parse((await context.params).id),
          )
        ).item,
      ),
    'content:manage',
  )
}
export function progressGET(request: Request) {
  return handle(request, async (actor) => {
    const q = query(request)
    if (!q.subject)
      throw new PracticeError('validation_failed', 400, 'Cần chọn môn học')
    return Response.json(
      await progress(
        actor.id,
        q.subject,
        q.cursor,
        q.limit,
        actor.role === 'admin',
      ),
    )
  })
}
export function reviewPOST(request: Request) {
  return handle(request, async (actor, requestId) => {
    const input = reviewInputSchema.parse(await body(request))
    const key = request.headers.get('Idempotency-Key')
    if (!key || key.length > 128)
      throw new PracticeError(
        'validation_failed',
        400,
        'Cần Idempotency-Key tối đa128ký tự',
      )
    const result = await createAttempt(
      { ...input, mode: 'review', type: 'mcq' },
      key,
      actor.id,
      requestId,
      undefined,
      actor.role === 'admin',
    )
    return Response.json(result.attempt, {
      status: result.replayed ? 200 : 201,
      headers: result.replayed ? { 'Idempotent-Replay': 'true' } : {},
    })
  })
}
