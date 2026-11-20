import { z } from 'zod'
import { handle, body } from '../http'
import { readBody } from '../security/body'
import { readAuthConfig } from '../../config'
import {
  bundleSchema,
  patchQuestionRevisionSchema,
} from '@pharmacy/api-contract/bundle'
import { questionStatuses } from '@pharmacy/core/lifecycle'
import { PracticeError } from '@pharmacy/db/practice'
import * as content from '@pharmacy/db/content'

type Context = { params: Promise<{ id: string }> }
async function id(context: Context) {
  return z.uuid().parse((await context.params).id)
}
const query = (request: Request) =>
  Object.fromEntries(new URL(request.url).searchParams)
const filters = z
  .object({
    subject: z.string().min(1).max(80).optional(),
    topic: z.uuid().optional(),
    type: z.literal('mcq').optional(),
    status: z.enum(questionStatuses).optional(),
    cursor: z.uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
const questionPatch = z
  .object({
    expected_version: z.number().int().positive(),
    status: z.enum(questionStatuses).optional(),
    revision: patchQuestionRevisionSchema.optional(),
  })
  .strict()
  .refine(
    (value) => Boolean(value.status) !== Boolean(value.revision),
    'Provide either status or a new revision',
  )
const reportSchema = z
  .object({
    reason: z.enum(['wrong_answer', 'ambiguous', 'typo', 'bad_image', 'other']),
    note: z.string().trim().max(2000).optional(),
    revision_id: z.uuid().optional(),
  })
  .strict()
export function questionsGET(request: Request) {
  return handle(
    request,
    async () =>
      Response.json(await content.listQuestions(filters.parse(query(request)))),
    'content:manage',
  )
}
export function questionGET(request: Request, context: Context) {
  return handle(
    request,
    async () => Response.json(await content.questionDetail(await id(context))),
    'content:manage',
  )
}
export function questionPATCH(request: Request, context: Context) {
  return handle(
    request,
    async (actor, requestId) =>
      Response.json(
        await content.patchQuestion(
          await id(context),
          questionPatch.parse(await body(request)),
          actor.id,
          requestId,
        ),
      ),
    'content:manage',
  )
}
async function uploadedBundle(request: Request) {
  const text = await readBody(request, 10000, readAuthConfig().MAX_IMPORT_BYTES)
  let json: string
  if (request.headers.get('content-type')?.startsWith('multipart/form-data')) {
    let form: FormData
    try {
      form = await new Request(request.url, {
        method: 'POST',
        headers: request.headers,
        body: text,
      }).formData()
    } catch {
      throw new PracticeError(
        'bundle_invalid',
        422,
        'Bundle multipart không hợp lệ',
      )
    }
    const files = form.getAll('bundle'),
      file = files[0]
    if (files.length !== 1 || !file)
      throw new PracticeError(
        'bundle_invalid',
        422,
        'Cần đúng một file bundle JSON',
      )
    json = typeof file === 'string' ? file : await file.text()
  } else if (
    request.headers.get('content-type')?.startsWith('application/json')
  )
    json = text
  else
    throw new PracticeError(
      'bundle_invalid',
      422,
      'Chỉ nhận bundle JSON hoặc multipart chứa bundle JSON',
    )
  try {
    return bundleSchema.parse(JSON.parse(json.replace(/^\uFEFF/, '')))
  } catch {
    throw new PracticeError(
      'bundle_invalid',
      422,
      'Bundle không đúng định dạng. Hãy chạy content:validate để kiểm tra.',
    )
  }
}
export function importsPOST(request: Request) {
  return handle(
    request,
    async (actor, requestId) => {
      const result = await content.importBundle(
        await uploadedBundle(request),
        actor.id,
        requestId,
      )
      return Response.json(result, {
        status: result.status === 'already_imported' ? 200 : 201,
      })
    },
    'content:manage',
    'import',
  )
}
export function importGET(request: Request, context: Context) {
  return handle(
    request,
    async () => Response.json(await content.getImport(await id(context))),
    'content:manage',
  )
}
export function reportsGET(request: Request) {
  return handle(
    request,
    async () =>
      Response.json(
        await content.listReports(
          z
            .object({
              status: z
                .enum(['open', 'accepted', 'rejected', 'resolved'])
                .optional(),
            })
            .strict()
            .parse(query(request)),
        ),
      ),
    'content:manage',
  )
}
export function reportPATCH(request: Request, context: Context) {
  return handle(
    request,
    async (actor, requestId) =>
      Response.json(
        await content.resolveReport(
          await id(context),
          z
            .object({
              status: z.enum(['accepted', 'rejected', 'resolved']),
              note: z.string().trim().max(2000).optional(),
            })
            .strict()
            .parse(await body(request)),
          actor.id,
          requestId,
        ),
      ),
    'content:manage',
  )
}
export function reportPOST(request: Request, context: Context) {
  return handle(request, async (actor, requestId) =>
    Response.json(
      await content.createReport(
        await id(context),
        reportSchema.parse(await body(request)),
        actor.id,
        requestId,
      ),
      { status: 201 },
    ),
  )
}
export function sourcesGET(request: Request) {
  return handle(
    request,
    async () => Response.json(await content.listSources()),
    'content:manage',
  )
}
export function sourcesPATCH(request: Request) {
  return handle(
    request,
    async (actor, requestId) =>
      Response.json(
        await content.reviewSource(
          z
            .object({
              id: z.uuid(),
              review_status: z.enum(['pending', 'approved', 'rejected']),
            })
            .strict()
            .parse(await body(request)),
          actor.id,
          requestId,
        ),
      ),
    'content:manage',
  )
}
export function assetGET(request: Request, context: Context) {
  return handle(request, async (actor) => {
    const asset = await content.getAsset(await id(context), actor)
    return new Response(new Uint8Array(asset.data), {
      headers: {
        'Content-Type': asset.mime,
        'Content-Disposition': 'inline',
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Cache-Control': 'private, no-store',
      },
    })
  })
}
