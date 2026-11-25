import { z } from 'zod'
import { visualPayloadSchema } from '../visual'

const normalized = (value: string) => value.trim().normalize('NFC')
const folded = (value: string) => normalized(value).toLocaleLowerCase('vi')
const text = (max: number) =>
  z.string().trim().min(1).max(max).transform(normalized)
const reference = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
const topicCode = reference
const sourceLinkSchema = z
  .object({ source_ref: reference, locator: text(2000) })
  .strict()
export const bundleChoiceSchema = z
  .object({
    label: z.enum(['A', 'B', 'C', 'D']),
    text: text(500),
    is_correct: z.boolean(),
  })
  .strict()
const choicesSchema = z
  .array(bundleChoiceSchema)
  .length(4)
  .superRefine((choices, context) => {
    if (new Set(choices.map((choice) => choice.label)).size !== 4)
      context.addIssue({
        code: 'custom',
        message: 'Choices must contain each label A/B/C/D once',
      })
    if (new Set(choices.map((choice) => folded(choice.text))).size !== 4)
      context.addIssue({
        code: 'custom',
        message:
          'Choice text must be distinct after NFC, trim and case normalization',
      })
    if (choices.filter((choice) => choice.is_correct).length !== 1)
      context.addIssue({
        code: 'custom',
        message: 'Exactly one choice must be correct',
      })
  })
const uniqueReferences = (value: readonly string[]) =>
  new Set(value).size === value.length
const topicCodesSchema = z
  .array(topicCode)
  .min(1)
  .max(100)
  .refine(uniqueReferences, 'Topic codes must be unique')
const answersSchema = z
  .array(text(500))
  .max(100)
  .refine(
    (values) => new Set(values.map(folded)).size === values.length,
    'Accepted answers must be distinct',
  )
const commonFields = {
  difficulty: z.number().int().min(1).max(3),
  stem: text(20000),
  explanation: text(50000),
  topic_codes: topicCodesSchema,
}
const revisionFields = {
  ...commonFields,
  choices: choicesSchema,
  accepted_answers: answersSchema.optional(),
}
const visualFields = {
  ...commonFields,
  visual: visualPayloadSchema,
  accepted_answers: answersSchema.optional(),
}
const visualQuestionSchema = z
  .object({
    external_id: reference,
    ...visualFields,
    type: z.enum(['name_from_structure', 'image_hotspot']),
    sources: z.array(sourceLinkSchema).min(1).max(100),
    asset_refs: z.array(reference).length(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.type !== value.visual.type ||
      (value.type === 'name_from_structure'
        ? !value.accepted_answers?.length
        : Boolean(value.accepted_answers?.length))
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Visual exercise kind and answer key must match',
      })
  })
export const bundleQuestionSchema = z
  .object({
    external_id: reference,
    type: z.literal('mcq'),
    ...revisionFields,
    sources: z.array(sourceLinkSchema).max(100),
    asset_refs: z
      .array(reference)
      .max(100)
      .refine(uniqueReferences, 'Asset refs must be unique')
      .optional(),
  })
  .strict()
const revisionSources = z
  .array(z.object({ source_id: z.uuid(), locator: text(2000) }).strict())
  .max(100)
const mcqPatchRevisionSchema = z
  .object({
    ...revisionFields,
    sources: revisionSources,
    asset_ids: z
      .array(z.uuid())
      .max(100)
      .refine(
        (ids) => new Set(ids.map((id) => id.toLowerCase())).size === ids.length,
        'Asset IDs must be unique',
      )
      .optional(),
  })
  .strict()
const visualPatchRevisionSchema = z
  .object({
    ...visualFields,
    sources: revisionSources.min(1),
    asset_ids: z.array(z.uuid()).length(1),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.visual.type === 'name_from_structure'
        ? !value.accepted_answers?.length
        : Boolean(value.accepted_answers?.length)
    )
      ctx.addIssue({
        code: 'custom',
        message: 'Visual exercise answer key is invalid',
      })
  })
export const patchQuestionRevisionSchema = z
  .union([mcqPatchRevisionSchema, visualPatchRevisionSchema])
  .superRefine((revision, context) => {
    const links = revision.sources.map(
      (source) => `${source.source_id.toLowerCase()}\0${source.locator}`,
    )
    if (new Set(links).size !== links.length)
      context.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'Source links must be unique',
      })
  })
export type PatchQuestionRevision = z.infer<typeof patchQuestionRevisionSchema>
export const bundleTopicLimit = 2000
const bundleTopicsSchema = z
  .array(
    z
      .object({
        code: topicCode,
        parent_code: topicCode.nullable(),
        title: text(500),
        sort_order: z.number().int().min(0).max(1000000).default(0),
      })
      .strict(),
  )
  .min(1)
  .max(bundleTopicLimit)
  .superRefine((topics, context) => {
    const parents = new Map(
      topics.map((topic) => [topic.code, topic.parent_code]),
    )
    if (parents.size !== topics.length)
      context.addIssue({
        code: 'custom',
        message: 'Topic codes must be unique',
      })

    for (const [index, topic] of topics.entries()) {
      if (topic.parent_code !== null && !parents.has(topic.parent_code))
        context.addIssue({
          code: 'custom',
          path: [index, 'parent_code'],
          message: 'Parent topic is not in this bundle',
        })
      const seen = new Set<string>()
      let current: string | null | undefined = topic.code
      while (current !== null && current !== undefined) {
        if (seen.has(current)) {
          context.addIssue({
            code: 'custom',
            path: [index, 'parent_code'],
            message: 'Topic graph must not contain cycles',
          })
          break
        }
        seen.add(current)
        current = parents.get(current)
      }
    }
  })
export const bundleSchema = z
  .object({
    schema_version: z.literal(1),
    manifest: z
      .object({
        subject: reference.max(80),
        label: text(200),
        generator: z.object({ name: text(120), version: text(80) }).strict(),
        created_at: z.iso.datetime({ offset: true }),
      })
      .strict(),
    topics: bundleTopicsSchema,
    sources: z
      .array(
        z
          .object({
            ref: reference,
            kind: z.enum(['notebooklm', 'web', 'upload', 'manual']),
            title: text(1000),
            locator: text(2000),
            license: text(2000),
            retrieved_at: z.iso.datetime({ offset: true }),
          })
          .strict(),
      )
      .max(2000),
    assets: z
      .array(
        z
          .object({
            ref: reference,
            kind: z.enum(['svg', 'png', 'jpeg', 'webp']),
            data_base64: z
              .string()
              .min(4)
              .max(50 * 1024 * 1024)
              .refine(
                (value) =>
                  value.length % 4 === 0 &&
                  /^[A-Za-z0-9+/]+={0,2}$/.test(value),
                'Asset data must be padded base64',
              ),
            license: text(2000),
            attribution: text(2000),
            alt_text: text(2000),
            source_ref: reference.optional(),
          })
          .strict(),
      )
      .max(200),
    questions: z
      .array(z.union([bundleQuestionSchema, visualQuestionSchema]))
      .min(1)
      .max(1000),
  })
  .strict()
  .superRefine((bundle, context) => {
    const duplicate = (
      values: string[],
      path: (string | number)[],
      label: string,
    ) => {
      if (!uniqueReferences(values))
        context.addIssue({
          code: 'custom',
          path,
          message: `${label} must be unique`,
        })
    }
    duplicate(
      bundle.sources.map((source) => source.ref),
      ['sources'],
      'Source refs',
    )
    duplicate(
      bundle.assets.map((asset) => asset.ref),
      ['assets'],
      'Asset refs',
    )
    duplicate(
      bundle.questions.map((question) => question.external_id),
      ['questions'],
      'Question external IDs',
    )
    const topics = new Set(bundle.topics.map((topic) => topic.code))
    const sources = new Set(bundle.sources.map((source) => source.ref))
    const assets = new Map(bundle.assets.map((asset) => [asset.ref, asset]))
    for (const [index, asset] of bundle.assets.entries())
      if (asset.source_ref !== undefined && !sources.has(asset.source_ref))
        context.addIssue({
          code: 'custom',
          path: ['assets', index, 'source_ref'],
          message: 'Asset source is not in this bundle',
        })
    for (const [index, question] of bundle.questions.entries()) {
      for (const code of question.topic_codes)
        if (!topics.has(code))
          context.addIssue({
            code: 'custom',
            path: ['questions', index, 'topic_codes'],
            message: 'Question topic is not in this bundle',
          })
      for (const link of question.sources)
        if (!sources.has(link.source_ref))
          context.addIssue({
            code: 'custom',
            path: ['questions', index, 'sources'],
            message: 'Question source is not in this bundle',
          })
      duplicate(
        question.sources.map((link) => `${link.source_ref}\0${link.locator}`),
        ['questions', index, 'sources'],
        'Question source links',
      )
      for (const ref of question.asset_refs ?? [])
        if (!assets.has(ref))
          context.addIssue({
            code: 'custom',
            path: ['questions', index, 'asset_refs'],
            message: 'Question asset is not in this bundle',
          })
      if (question.type !== 'mcq') {
        const asset = assets.get(question.asset_refs[0]!)
        if (
          !asset?.source_ref ||
          !question.sources.some((link) => link.source_ref === asset.source_ref)
        )
          context.addIssue({
            code: 'custom',
            path: ['questions', index, 'asset_refs'],
            message:
              'Visual exercises require a licensed asset and linked provenance',
          })
        if (question.type === 'name_from_structure' && asset?.kind !== 'svg')
          context.addIssue({
            code: 'custom',
            path: ['questions', index, 'asset_refs'],
            message: 'Structure image must be a validated SVG',
          })
      }
    }
  })
export type Bundle = z.infer<typeof bundleSchema>
