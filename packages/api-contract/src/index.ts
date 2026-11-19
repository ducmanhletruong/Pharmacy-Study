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
          assets: z
            .array(
              z
                .object({
                  id: uuid,
                  url: z.string().regex(/^\/api\/v1\/assets\/[a-f0-9-]{36}$/i),
                  mime: z.enum([
                    'image/svg+xml',
                    'image/png',
                    'image/jpeg',
                    'image/webp',
                  ]),
                  alt_text: z.string(),
                })
                .strict(),
            )
            .default([]),
        })
        .strict(),
    ),
  })
  .strict()
export const resultSchema = z
  .object({
    attempt_id: uuid,
    total: z.number().int().nonnegative(),
    correct: z.number().int().nonnegative(),
    unanswered: z.number().int().nonnegative(),
    score: z.number().min(0).max(10),
    by_topic: z.array(
      z
        .object({
          topic_id: uuid,
          title: z.string(),
          total: z.number().int().nonnegative(),
          correct: z.number().int().nonnegative(),
        })
        .strict()
        .refine((topic) => topic.correct <= topic.total, {
          message: 'Topic correct count cannot exceed its total',
          path: ['correct'],
        }),
    ),
  })
  .strict()
  .superRefine((result, context) => {
    if (result.correct > result.total)
      context.addIssue({
        code: 'custom',
        path: ['correct'],
        message: 'Correct count cannot exceed total',
      })
    if (result.unanswered > result.total - result.correct)
      context.addIssue({
        code: 'custom',
        path: ['unanswered'],
        message: 'Correct and unanswered counts cannot exceed total',
      })
    const topicIds = new Set<string>()
    for (const [index, topic] of result.by_topic.entries()) {
      if (topic.total > result.total)
        context.addIssue({
          code: 'custom',
          path: ['by_topic', index, 'total'],
          message: 'Topic total cannot exceed attempt total',
        })
      if (topic.correct > result.correct)
        context.addIssue({
          code: 'custom',
          path: ['by_topic', index, 'correct'],
          message: 'Topic correct count cannot exceed attempt correct count',
        })
      const topicId = topic.topic_id.toLowerCase()
      if (topicIds.has(topicId))
        context.addIssue({
          code: 'custom',
          path: ['by_topic', index, 'topic_id'],
          message: 'Topic IDs must be unique within a result',
        })
      topicIds.add(topicId)
    }
    const expectedScore = result.total
      ? Math.round((result.correct / result.total) * 100) / 10
      : 0
    if (result.score !== expectedScore)
      context.addIssue({
        code: 'custom',
        path: ['score'],
        message: 'Score must match counts rounded to one decimal place',
      })
  })
export type CreateAttempt = z.infer<typeof createAttemptSchema>
export type Attempt = z.infer<typeof attemptSchema>
export type Feedback = z.infer<typeof feedbackSchema>
export type Result = z.infer<typeof resultSchema>
