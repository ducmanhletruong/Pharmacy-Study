import { readAuthConfig } from '../../config'
import { z } from 'zod'
import {
  writtenPaperInputSchema,
  writtenStartSchema,
  writtenAnswerSchema,
  writtenGradeSchema,
} from '@pharmacy/api-contract'
import * as written from '@pharmacy/db/written'
import { handle, body } from '../http'
import { readBody } from '../security/body'
const uuid = z.uuid()
type Context = { params: Promise<{ id: string }> }
const id = async (context: Context) => uuid.parse((await context.params).id)
export function papersGET(request: Request) {
  return handle(request, async (actor) => {
    const q = z
      .object({
        cursor: uuid.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .strict()
      .parse(Object.fromEntries(new URL(request.url).searchParams))
    return Response.json(
      await written.writtenPapers(actor.id, q.cursor, q.limit),
    )
  })
}
export function papersPOST(request: Request) {
  return handle(
    request,
    async (actor, requestId) =>
      Response.json(
        await written.saveWrittenPaper(
          writtenPaperInputSchema.parse(
            JSON.parse(
              await readBody(request, 10000, readAuthConfig().MAX_IMPORT_BYTES),
            ),
          ),
          actor.id,
          requestId,
        ),
        { status: 201 },
      ),
    'practice:use',
    'import',
  )
}
export function startPOST(request: Request) {
  return handle(request, async (actor, requestId) => {
    const input = writtenStartSchema.parse(await body(request))
    const r = await written.startWritten(
      input.paper_id,
      actor.id,
      request.headers.get('Idempotency-Key') ?? '',
      requestId,
    )
    return Response.json(r.attempt, {
      status: r.replayed ? 200 : 201,
      headers: r.replayed ? { 'Idempotent-Replay': 'true' } : {},
    })
  })
}
export function attemptGET(request: Request, context: Context) {
  return handle(request, async (actor, requestId) =>
    Response.json(
      await written.getWritten(await id(context), actor.id, requestId),
    ),
  )
}
export function answerPUT(request: Request, context: Context) {
  return handle(
    request,
    async (actor, requestId) => {
      const input = writtenAnswerSchema.parse(
        JSON.parse(await readBody(request, 10000, 128 * 1024)),
      )
      return Response.json(
        await written.saveWrittenAnswer(
          await id(context),
          actor.id,
          input.position,
          input.text,
          requestId,
        ),
      )
    },
    'practice:use',
    'import',
  )
}
export function submitPOST(request: Request, context: Context) {
  return handle(request, async (actor, requestId) =>
    Response.json(
      await written.submitWritten(await id(context), actor.id, requestId),
    ),
  )
}
export function gradePOST(request: Request, context: Context) {
  return handle(request, async (actor, requestId) =>
    Response.json(
      await written.gradeWritten(
        await id(context),
        actor.id,
        writtenGradeSchema.parse(await body(request)).points,
        requestId,
      ),
    ),
  )
}
export function pdfGET(request: Request, context: Context) {
  return handle(request, async (actor) => {
    const q = z
      .object({ reference_for: uuid.optional() })
      .strict()
      .parse(Object.fromEntries(new URL(request.url).searchParams))
    const bytes = await written.writtenPdf(
      await id(context),
      actor.id,
      q.reference_for,
    )
    return new Response(new Uint8Array(bytes), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="private-written-paper.pdf"',
        'Content-Security-Policy': "sandbox; default-src 'none'",
        'X-Content-Type-Options': 'nosniff',
      },
    })
  })
}

export function attemptsGET(request: Request) {
  return handle(request, async (actor) => {
    const query = z
      .object({
        cursor: uuid.optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20),
      })
      .strict()
      .parse(Object.fromEntries(new URL(request.url).searchParams))
    return Response.json(
      await written.writtenHistory(actor.id, query.cursor, query.limit),
    )
  })
}
