import { z } from 'zod'
export { ZodError } from 'zod'

export const label = z.enum(['A', 'B', 'C', 'D'])
export const uuid = z.uuid()
export const subjectSchema = z
  .object({
    id: uuid,
    code: z.string(),
    name: z.string(),
    question_count: z.number().int().nonnegative(),
  })
  .strict()
export const topicSchema = z
  .object({
    id: uuid,
    parent_id: uuid.nullable(),
    code: z.string(),
    title: z.string(),
    sort_order: z.number().int(),
  })
  .strict()
export const createAttemptSchema = z
  .object({
    subject: z.string().min(1).max(80),
    mode: z.literal('practice'),
    topic_ids: z.array(uuid).max(100).optional(),
    type: z.literal('mcq').default('mcq'),
    difficulty: z.number().int().min(1).max(3).optional(),
    count: z.number().int().min(1).max(10).default(10),
  })
  .strict()
export const answerSchema = z
  .object({ answer: label, flagged: z.boolean().optional() })
  .strict()
export const sourceSchema = z
  .object({ title: z.string(), locator: z.string() })
  .strict()
export const feedbackSchema = z
  .object({
    is_correct: z.boolean(),
    correct_answer: label,
    explanation: z.string(),
    sources: z.array(sourceSchema),
  })
  .strict()
export const attemptSchema = z
  .object({
    id: uuid,
    subject: z.string(),
    mode: z.literal('practice'),
    status: z.enum(['in_progress', 'submitted', 'expired']),
    items: z.array(
      z
        .object({
          position: z.number().int().positive(),
          question_id: uuid,
          revision_id: uuid,
          stem: z.string(),
          choices: z
            .array(z.object({ label, text: z.string() }).strict())
            .length(4),
          answer: label.nullable(),
          flagged: z.boolean(),
        })
        .strict(),
    ),
  })
  .strict()
export const resultSchema = z
  .object({
    attempt_id: uuid,
    total: z.number().int(),
    correct: z.number().int(),
    unanswered: z.number().int(),
    score: z.number().min(0).max(10),
    by_topic: z.array(
      z
        .object({
          topic_id: uuid,
          title: z.string(),
          total: z.number().int(),
          correct: z.number().int(),
        })
        .strict(),
    ),
  })
  .strict()
export type CreateAttempt = z.infer<typeof createAttemptSchema>
export type Attempt = z.infer<typeof attemptSchema>
export type Feedback = z.infer<typeof feedbackSchema>
export type Result = z.infer<typeof resultSchema>
