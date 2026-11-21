import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { generateBounded, sourceData, type LlmProvider } from '../llm'
import { verify } from '../verify'
import { prepareBundle, writeBundle, sha256 } from '../bundle'
import type { KnowledgeSource } from '../knowledge'
export type RunOptions = {
  subject: string
  topic: string
  output: string
  dry_run: boolean
  max_cost: number
  estimated_max_cost: number
}
export async function run(
  options: RunOptions,
  knowledge: KnowledgeSource,
  provider: LlmProvider,
) {
  if (!options.dry_run && provider.name !== 'mock')
    throw Error(
      'Live cost policy and model authorization must be configured before inference',
    )
  if (
    !Number.isFinite(options.max_cost) ||
    options.max_cost < 0 ||
    !Number.isFinite(options.estimated_max_cost) ||
    options.estimated_max_cost < 0 ||
    options.estimated_max_cost > options.max_cost
  )
    throw Error('max-cost exceeded or invalid budget')
  if (
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(options.subject) ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(options.topic)
  )
    throw Error('Invalid subject/topic')
  const sources = await knowledge.read()
  const prompt = await readFile(
    new URL('../../prompts/mcq-v1.txt', import.meta.url),
    'utf8',
  )
  const data = sourceData(sources, options.subject, options.topic)
  if (options.dry_run)
    return {
      dry_run: true,
      provider: provider.name,
      model: provider.model,
      source_count: sources.length,
      prompt_sha256: sha256(prompt),
      estimated_max_cost: options.estimated_max_cost,
      actual_cost: 0,
    }
  // Zero automatic retries: an error with unknown usage may still be charged.
  // Reserve the declared maximum before invoking the provider and never refund
  // unknown usage. Live provider orchestration remains gated on approved rates.
  await mkdir(options.output, { recursive: false })
  const ledger = join(options.output, 'cost.json')
  await writeFile(
    ledger,
    JSON.stringify({
      status: 'reserved',
      reserved_cost: options.estimated_max_cost,
      provider: provider.name,
      model: provider.model,
    }) + '\n',
    { flag: 'wx', mode: 0o600 },
  )
  try {
    const result = await generateBounded(provider, prompt, data, {
      timeout_ms: 60000,
      retries: 0,
    })
    const questions = verify({ questions: result.questions }, sources)
    if (
      questions.some(
        (q) => q.topic_codes.length !== 1 || q.topic_codes[0] !== options.topic,
      )
    )
      throw Error('Generated topic mismatch')
    const now = new Date().toISOString()
    const bundle = {
      schema_version: 1,
      manifest: {
        subject: options.subject,
        label: 'Generated draft; administrator review required',
        generator: { name: provider.name, version: 'mcq-v1' },
        created_at: now,
      },
      topics: [
        {
          code: options.topic,
          parent_code: null,
          title: options.topic,
          sort_order: 0,
        },
      ],
      sources: sources.map((s) => ({
        ref: s.ref,
        kind: 'manual',
        title: s.title,
        locator: s.locator,
        license: s.license,
        retrieved_at: now,
      })),
      assets: [],
      questions,
    }
    const metadata = {
      provider: provider.name,
      model: provider.model,
      prompt_version: 'mcq-v1',
      prompt,
      sources,
    }
    prepareBundle(bundle, metadata)
    await writeBundle(join(options.output, 'bundle'), bundle, metadata)
    const report = {
      status: 'completed',
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      reserved_cost: options.estimated_max_cost,
      actual_cost: provider.name === 'mock' ? 0 : null,
      accepted: questions.length,
      rejected: 0,
    }
    await writeFile(ledger, JSON.stringify(report, null, 2) + '\n', {
      mode: 0o600,
    })
    return report
  } catch (error) {
    await writeFile(
      ledger,
      JSON.stringify({
        status: 'failed_usage_unknown',
        reserved_cost: options.estimated_max_cost,
        actual_cost: null,
      }) + '\n',
      { mode: 0o600 },
    )
    throw error
  }
}
