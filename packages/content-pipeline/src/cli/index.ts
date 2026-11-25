import { parseArgs } from 'node:util'
import { readFile } from 'node:fs/promises'
import { LocalKnowledgeSource } from '../knowledge'
import type { LlmProvider } from '../llm'
import { run } from './run'
import { readTaxonomyFile } from '../taxonomy-file'
import { OpenAiProvider } from '../llm/openai'
import { paidModel, smokeOutputCap } from '../llm/budget'
async function main() {
  const { values } = parseArgs({
    options: {
      sources: { type: 'string' },
      output: { type: 'string' },
      subject: { type: 'string' },
      topic: { type: 'string' },
      taxonomy: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'max-cost': { type: 'string' },
      'mock-output': { type: 'string' },
      provider: { type: 'string', default: 'mock' },
      'confirm-paid-batch': { type: 'boolean', default: false },
      'ledger-dir': { type: 'string' },
    },
  })
  if (
    !values.output ||
    !values.subject ||
    !values.topic ||
    values['max-cost'] === undefined
  )
    throw Error(
      'Required: --sources --output --subject --topic --max-cost; optional --dry-run --mock-output',
    )
  const live = values.provider === 'openai'
  if (!live && (values.provider !== 'mock' || !values.sources))
    throw Error('Mock generation requires an explicit local source directory')
  if (
    live &&
    (values.subject !== 'synthetic' ||
      values.sources ||
      values['mock-output'] ||
      (!values['dry-run'] &&
        (!values['confirm-paid-batch'] ||
          !values['ledger-dir'] ||
          !process.env.OPENAI_API_KEY)))
  )
    throw Error(
      'Only the built-in synthetic OpenAI pilot is allowed with explicit billing authorization',
    )
  if (!live && !values['dry-run'] && !values['mock-output'])
    throw Error(
      'Live generation requires approved OpenAI access/model/rates; only explicit --mock-output is enabled until then',
    )
  const provider: LlmProvider = {
    name: 'mock',
    model: 'synthetic-offline',
    generate: async () => {
      if (!values['mock-output']) throw Error('Missing mock fixture')
      const info = await readFile(values['mock-output'], 'utf8')
      if (Buffer.byteLength(info) > 1024 * 1024)
        throw Error('Mock output exceeds limit')
      const raw: unknown = JSON.parse(info)
      if (
        !raw ||
        typeof raw !== 'object' ||
        !Array.isArray((raw as { questions: unknown }).questions)
      )
        throw Error('Invalid mock output')
      return {
        questions: (raw as { questions: unknown[] }).questions,
        input_tokens: 0,
        output_tokens: 0,
      }
    },
  }
  const taxonomy = values.taxonomy
    ? await readTaxonomyFile(values.taxonomy)
    : undefined
  const knowledge = live
    ? {
        read: async () => [
          {
            ref: 'synthetic-arithmetic',
            title: 'Project-authored synthetic arithmetic facts',
            locator: 'Synthetic pilot facts',
            license: 'project-authored',
            text: 'A zero value added to nine gives 9. Three added to four gives 7. Twice eight is 16. Half of twelve is 6. Four times five gives 20.',
          },
        ],
      }
    : new LocalKnowledgeSource(values.sources!)
  const activeProvider: LlmProvider = live
    ? values['dry-run']
      ? {
          name: 'openai',
          model: paidModel,
          generate: async () => {
            throw Error('Dry-run cannot call inference')
          },
        }
      : new OpenAiProvider({
          api_key: process.env.OPENAI_API_KEY!,
          model: paidModel,
          max_output_tokens: smokeOutputCap,
          billing_approved: true,
        })
    : provider
  const report = await run(
    {
      subject: values.subject,
      topic: values.topic,
      output: values.output,
      dry_run: values['dry-run'],
      max_cost: Number(values['max-cost']),
      estimated_max_cost: 0,
      taxonomy,
      ...(live && values['ledger-dir']
        ? { paid: { ledgerDir: values['ledger-dir'] } }
        : {}),
    },
    knowledge,
    activeProvider,
  )
  console.log(JSON.stringify(report))
  if ('accepted' in report && report.accepted === 0) process.exitCode = 2
}
main().catch(() => {
  console.error(
    'Generation failed; inspect configuration, source permissions and private cost log.',
  )
  process.exitCode = 1
})
