import { parseArgs } from 'node:util'
import { readFile, stat } from 'node:fs/promises'
import {
  auditDecisions,
  reportCode,
  reportAudience,
  reportCodes,
  chunkAssignments,
  reviewedQuestionIndex,
  sourceChunkLedger,
} from '@pharmacy/api-contract'
import { bundleSchema } from '@pharmacy/api-contract/bundle'
import { LocalKnowledgeSource } from '../knowledge'
import { readTaxonomyFile } from '../taxonomy-file'
import { auditSample, chunkLedger, coverage } from '../chunks'

async function json(path: string | undefined) {
  if (!path) throw Error('A required input file was not supplied')
  const info = await stat(path)
  if (!info.isFile() || info.size > 16 * 1024 * 1024)
    throw Error('Invalid report input size')
  return JSON.parse(await readFile(path, 'utf8')) as unknown
}

async function main() {
  const {
    positionals: [mode],
    values,
  } = parseArgs({
    allowPositionals: true,
    options: {
      sources: { type: 'string' },
      assignments: { type: 'string' },
      ledger: { type: 'string' },
      questions: { type: 'string' },
      subject: { type: 'string' },
      audience: { type: 'string' },
      taxonomy: { type: 'string' },
      n: { type: 'string', default: '100' },
      seed: { type: 'string' },
      decisions: { type: 'string' },
      check: { type: 'boolean' },
      'require-source-match': { type: 'boolean' },
    },
  })
  if (mode !== 'audit' && values.decisions)
    throw Error('Decisions are only supported by the audit mode')
  if (mode !== 'coverage' && values['require-source-match'])
    throw Error('Source matching is only supported by coverage mode')
  const audience = reportAudience.optional().parse(values.audience)
  if (values.check) {
    if (!audience || (mode !== 'coverage' && mode !== 'audit'))
      throw Error('Release checks require coverage or audit and an audience')
    if (mode === 'coverage' && !values['require-source-match'])
      throw Error('Coverage release checks require source matching')
    if (mode === 'audit' && (Number(values.n) !== 100 || !values.decisions))
      throw Error('Audit release checks require 100 questions and decisions')
  }
  if (mode === 'chunks') {
    if (audience)
      throw Error('Audience is only supported by coverage and audit')
    if (!values.sources) throw Error('A local source directory is required')
    const assignments = values.assignments
      ? chunkAssignments.parse(await json(values.assignments))
      : {}
    console.log(
      JSON.stringify(
        chunkLedger(
          await new LocalKnowledgeSource(values.sources).read(),
          assignments,
        ),
        null,
        2,
      ),
    )
    return
  }
  const subject = reportCode.parse(values.subject)
  const questions = reviewedQuestionIndex.parse(await json(values.questions))
  if (mode === 'coverage') {
    const chunks = sourceChunkLedger.parse(await json(values.ledger))
    if (!values.taxonomy) throw Error('A taxonomy file is required')
    const taxonomy = await readTaxonomyFile(values.taxonomy)
    const legacyCodes = reportCodes.safeParse(taxonomy)
    const codes =
      !values.check && legacyCodes.success
        ? legacyCodes.data
        : bundleSchema.shape.topics.parse(taxonomy).map((topic) => topic.code)
    const report = coverage(
      chunks,
      questions,
      subject,
      codes,
      values['require-source-match'],
      audience,
    )
    console.log(JSON.stringify(report, null, 2))
    if (values.check && !report.taxonomy_coverage.meets_target)
      process.exitCode = 2
  } else if (mode === 'audit') {
    const report = auditSample(
      questions,
      subject,
      Number(values.n),
      values.seed ?? `audit:${subject}:v1`,
      values.decisions
        ? auditDecisions.parse(await json(values.decisions))
        : undefined,
      audience,
    )
    console.log(JSON.stringify(report, null, 2))
    if (values.check && !report.review?.meets_sample_target)
      process.exitCode = 2
  } else {
    throw Error('Unknown report mode')
  }
}

const evidenceErrors = new Set([
  'Release checks require coverage or audit and an audience',
  'Coverage release checks require source matching',
  'Audit release checks require 100 questions and decisions',
  'Regenerate the review index with audience metadata',
  'Regenerate the evidence with source fingerprints',
  'Evidence chunk is not from a source cited by the revision',
])
main().catch((error: unknown) => {
  if (error instanceof Error && evidenceErrors.has(error.message))
    console.error(error.message)
  console.error(
    'Report failed. Check the mode, arguments and local input formats.',
  )
  process.exitCode = 1
})
