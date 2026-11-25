import { z } from 'zod'

export const questionTypeSchema = z.enum([
  'mcq',
  'name_from_structure',
  'image_hotspot',
])
export type QuestionType = z.infer<typeof questionTypeSchema>
const key = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/)
const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)])
const part = z
  .object({ id: key, label: z.string().trim().min(1).max(150) })
  .strict()
const regions = z
  .array(part.extend({ points: z.array(point).min(3).max(60) }))
  .min(2)
  .max(30)
const hotspot = z
  .object({ mode: z.enum(['click', 'select']), regions, correct_region: key })
  .strict()
  .superRefine((v, ctx) => {
    if (
      new Set(v.regions.map((r) => r.id)).size !== v.regions.length ||
      !v.regions.some((r) => r.id === v.correct_region)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Regions need unique IDs and a valid answer',
      })
    for (const [index, region] of v.regions.entries()) {
      const area = region.points.reduce((sum, [x, y], i) => {
        const [nx, ny] = region.points[(i + 1) % region.points.length]!
        return sum + x * ny - nx * y
      }, 0)
      if (Math.abs(area) <= 1e-12)
        ctx.addIssue({
          code: 'custom',
          message: 'A hotspot needs a positive area',
          path: ['regions', index, 'points'],
        })
    }
  })
export const visualPayloadSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('name_from_structure'),
      smiles: z
        .string()
        .trim()
        .min(1)
        .max(2048)
        .regex(/^[\x20-\x7e]+$/u),
    })
    .strict(),
  z.object({ type: z.literal('image_hotspot'), hotspot }).strict(),
])
export const visualPromptSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('name_from_structure') }).strict(),
  z
    .object({
      type: z.literal('image_hotspot'),
      mode: z.enum(['click', 'select']),
      regions: z.array(part).min(2).max(30),
    })
    .strict(),
])
export const attemptAnswerValueSchema = z.union([
  z.enum(['A', 'B', 'C', 'D']),
  z
    .object({
      kind: z.literal('name'),
      text: z.string().trim().min(1).max(500),
    })
    .strict(),
  z.object({ kind: z.literal('region'), id: key }).strict(),
  z.object({ kind: z.literal('point'), point }).strict(),
])
export type AttemptAnswer = z.infer<typeof attemptAnswerValueSchema>
