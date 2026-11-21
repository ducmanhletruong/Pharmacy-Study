import { parseArgs } from 'node:util'
import { readFile } from 'node:fs/promises'
import { LocalKnowledgeSource } from '../knowledge'
import type { LlmProvider } from '../llm'
import { run } from './run'
async function main() {
  const { values } = parseArgs({
    options: {
      sources: { type: 'string' },
      output: { type: 'string' },
      subject: { type: 'string' },
      topic: { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      'max-cost': { type: 'string' },
      'mock-output': { type: 'string' },
    },
  })
  if (
    !values.sources ||
    !values.output ||
    !values.subject ||
    !values.topic ||
    values['max-cost'] === undefined
  )
    throw Error(
      'Required: --sources --output --subject --topic --max-cost; optional --dry-run --mock-output',
    )
  if (!values['dry-run'] && !values['mock-output'])
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
  console.log(
    JSON.stringify(
      await run(
        {
          subject: values.subject,
          topic: values.topic,
          output: values.output,
          dry_run: values['dry-run'],
          max_cost: Number(values['max-cost']),
          estimated_max_cost: 0,
        },
        new LocalKnowledgeSource(values.sources),
        provider,
      ),
    ),
  )
}
main().catch(() => {
  console.error(
    'Generation failed; inspect configuration, source permissions and private cost log.',
  )
  process.exitCode = 1
})
