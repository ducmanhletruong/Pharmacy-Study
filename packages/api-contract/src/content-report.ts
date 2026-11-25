import { z } from 'zod'

export const reportCode = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/)
const hash = z.string().regex(/^[a-f0-9]{64}$/)
export const revisionChunkMapping = z.record(z.uuid(), z.array(hash).max(1000))
export const reportCodes = z.array(reportCode).max(1000)
export const chunkAssignments = z.record(
  z.string().regex(/^[\w.-]+:[1-9]\d*$/),
  reportCodes,
)
export const reportAudience = z.enum(['public', 'class'])
export const reviewedQuestionIndex = z
  .array(
    z
      .object({
        id: reportCode,
        revision_id: z.uuid().optional(),
        subject: reportCode,
        type: reportCode,
        status: z.enum([
          'draft',
          'verified',
          'approved',
          'under_review',
          'hidden',
          'retired',
        ]),
        topic_codes: reportCodes,
        chunk_ids: z.array(hash).max(1000),
        source_fingerprints: z.array(hash).max(1000).optional(),
        minimum_tier: z
          .union([z.literal(1), z.literal(2), z.literal(3)])
          .nullable()
          .optional(),
      })
      .strict(),
  )
  .max(100000)
export const auditDecisions = z
  .array(
    z
      .object({
        id: reportCode,
        revision_id: z.uuid(),
        correct: z.boolean(),
      })
      .strict(),
  )
  .max(1000)
export const sourceChunkLedger = z
  .array(
    z
      .object({
        id: hash,
        source_ref: reportCode,
        section: z.int().positive(),
        content_sha256: hash,
        source_fingerprint: hash.optional(),
        topic_codes: reportCodes,
        status: z.enum(['unmapped', 'mapped']),
      })
      .strict(),
  )
  .max(100000)
