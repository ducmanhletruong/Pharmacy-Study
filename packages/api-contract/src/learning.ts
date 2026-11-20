import { z } from 'zod'
export const blueprintSpecSchema = z
  .object({
    duration_seconds: z.number().int().min(1).max(14400),
    deadline_policy: z
      .literal('expired_grade_saved')
      .default('expired_grade_saved'),
    slots: z
      .array(
        z
          .object({
            topic_id: z.uuid().optional(),
            difficulty: z.number().int().min(1).max(3).optional(),
            count: z.number().int().min(1).max(200),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict()
  .refine(
    (spec) => spec.slots.reduce((sum, slot) => sum + slot.count, 0) <= 200,
    'Maximum 200 questions',
  )
export const blueprintInputSchema = z
  .object({
    subject: z.string().min(1).max(80),
    name: z.string().trim().min(1).max(120),
    status: z.enum(['draft', 'active', 'retired']),
    spec: blueprintSpecSchema,
    expected_version: z.number().int().positive().optional(),
  })
  .strict()
export const reviewInputSchema = z
  .object({
    subject: z.string().min(1).max(80),
    source: z.enum(['wrong', 'flagged']),
    count: z.number().int().min(1).max(10).default(10),
  })
  .strict()
export type BlueprintSpec = z.infer<typeof blueprintSpecSchema>
export type BlueprintInput = z.infer<typeof blueprintInputSchema>
