import { z } from 'zod'
export const writtenSectionsSchema = z
  .array(
    z
      .object({
        title: z.string().trim().min(1).max(200),
        max_points: z.number().positive().max(10),
      })
      .strict(),
  )
  .min(1)
  .max(20)
  .refine(
    (sections) =>
      Math.abs(sections.reduce((sum, s) => sum + s.max_points, 0) - 10) <
      0.000001,
    'Section points must total 10',
  )
export const writtenPaperInputSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    subject: z.string().min(1).max(80),
    duration_seconds: z.number().int().min(1).max(14400),
    sections: writtenSectionsSchema,
    exam_pdf_base64: z.string().min(8).max(7_000_000),
    reference_pdf_base64: z.string().min(8).max(7_000_000).optional(),
  })
  .strict()
export const writtenStartSchema = z.object({ paper_id: z.uuid() }).strict()
export const writtenAnswerSchema = z
  .object({
    position: z.number().int().min(1).max(20),
    text: z.string().max(20000),
  })
  .strict()
export const writtenGradeSchema = z
  .object({ points: z.array(z.number().min(0).max(10)).min(1).max(20) })
  .strict()
export type WrittenPaperInput = z.infer<typeof writtenPaperInputSchema>
export type WrittenSection = z.infer<typeof writtenSectionsSchema>[number]
export type WrittenAttempt = {
  id: string
  paper_id: string
  name: string
  status: 'in_progress' | 'submitted' | 'expired'
  deadline_at: string
  server_time: string
  sections: WrittenSection[]
  answers: { position: number; text: string; points: number | null }[]
  score: number | null
  grading_status: 'ungraded' | 'self_assessed'
  reference_available: boolean
}
