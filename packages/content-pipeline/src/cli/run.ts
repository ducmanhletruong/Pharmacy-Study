import { randomUUID } from 'node:crypto'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { generateBounded, sourceData, type LlmProvider } from '../llm'
import { verify } from '../verify'
import { prepareBundle, writeBundle, sha256 } from '../bundle'
import type { KnowledgeSource } from '../knowledge'
import { bundleSchema } from '@pharmacy/api-contract/bundle'
import {
  OpenAiOutputError,
  OpenAiRequestError,
  OpenAiResponseError,
} from '../llm/openai'
import {
  estimateSmokeCost,
  paidModel,
  pricedUsage,
  reserveBudget,
} from '../llm/budget'
export type RunOptions = {
  subject: string
  topic: string
  output: string
  dry_run: boolean
  max_cost: number
  estimated_max_cost: number
  taxonomy?: unknown
  paid?: { ledgerDir: string }
}
export async function run(
  options: RunOptions,
  knowledge: KnowledgeSource,
  provider: LlmProvider,
) {
  if (
    !options.dry_run &&
    provider.name !== 'mock' &&
    (!options.paid ||
      provider.name !== 'openai' ||
      provider.model !== paidModel)
  )
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
  const taxonomy =
    options.taxonomy === undefined
      ? undefined
      : bundleSchema.shape.topics.parse(options.taxonomy)
  const allowedTopics = taxonomy
    ? new Set(taxonomy.map((topic) => topic.code))
    : undefined
  if (allowedTopics && !allowedTopics.has(options.topic))
    throw Error('Requested topic is not in the taxonomy')
  const sources = await knowledge.read()
  const prompt = await readFile(
    new URL('../../prompts/mcq-v1.txt', import.meta.url),
    'utf8',
  )
  const data = sourceData(sources, options.subject, options.topic)
  const paid = provider.name === 'openai' && provider.model === paidModel
  const instruction = paid
    ? prompt + '\nGenerate exactly five synthetic practice MCQs.'
    : prompt
  const estimated = paid
    ? estimateSmokeCost(instruction, data) / 1_000_000
    : options.estimated_max_cost
  if (estimated > options.max_cost) throw Error('max-cost exceeded')
  if (options.dry_run)
    return {
      dry_run: true,
      provider: provider.name,
      model: provider.model,
      source_count: sources.length,
      prompt_sha256: sha256(instruction),
      estimated_max_cost: estimated,
      actual_cost: 0,
    }
  // Zero automatic retries: an error with unknown usage may still be charged.
  // Reserve the declared maximum before invoking the provider and never refund
  // unknown usage. Live provider orchestration remains gated on approved rates.
  await mkdir(options.output, { recursive: false })
  const ledger = join(options.output, 'cost.json')
  const clientRequestId = paid ? randomUUID() : undefined
  const runMetadata = {
    reserved_cost: estimated,
    provider: provider.name,
    model: provider.model,
    started_at: new Date().toISOString(),
    ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
  }
  await writeFile(
    ledger,
    JSON.stringify({ status: 'reserved', ...runMetadata }) + '\n',
    { flag: 'wx', mode: 0o600 },
  )
  let actual: number | null = paid ? null : 0
  let usage: { input_tokens: number; output_tokens: number } | undefined
  let providerRequestId: string | undefined
  let settle: ((actual: number) => Promise<void>) | undefined
  try {
    settle = paid
      ? await reserveBudget(
          options.paid!.ledgerDir,
          Math.round(estimated * 1_000_000),
          Math.floor(options.max_cost * 1_000_000),
        )
      : undefined
    const result = await generateBounded(provider, instruction, data, {
      timeout_ms: 60000,
      retries: 0,
      clientRequestId,
    })
    providerRequestId = result.provider_request_id
    usage = {
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
    }
    if (paid) {
      const micros = pricedUsage(usage.input_tokens, usage.output_tokens)
      actual = micros / 1_000_000
      await settle!(micros)
      if (result.questions.length !== 5)
        throw Error('Unexpected paid pilot batch size')
    }
    const { accepted: questions, rejected } = verify(
      { questions: result.questions },
      sources,
      allowedTopics
        ? { allowed: allowedTopics }
        : { defaultCode: options.topic },
    )
    const codes = [
      ...new Set([
        options.topic,
        ...questions.flatMap((question) => question.topic_codes),
      ]),
    ]
    const now = new Date().toISOString()
    const bundle = {
      schema_version: 1,
      manifest: {
        subject: options.subject,
        label: 'Generated draft; administrator review required',
        generator: { name: provider.name, version: 'mcq-v1' },
        created_at: now,
      },
      topics:
        taxonomy ??
        codes.map((code, sort_order) => ({
          code,
          title: code,
          parent_code: null,
          sort_order,
        })),
      sources: sources.map((s) => ({
        ref: s.ref,
        kind: s.kind ?? 'manual',
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
      prompt: instruction,
      sources,
    }
    if (questions.length) {
      prepareBundle(bundle, metadata)
      await writeBundle(join(options.output, 'bundle'), bundle, metadata)
    }
    await writeFile(
      join(options.output, 'rejections.json'),
      JSON.stringify(rejected, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    )
    const report = {
      status: questions.length ? 'completed' : 'rejected_all',
      ...runMetadata,
      ...usage,
      ...(providerRequestId ? { provider_request_id: providerRequestId } : {}),
      actual_cost: actual,
      accepted: questions.length,
      rejected: rejected.length,
      ...(!taxonomy
        ? { taxonomy_warning: 'No taxonomy supplied; flat topic codes used' }
        : {}),
    }
    await writeFile(ledger, JSON.stringify(report, null, 2) + '\n', {
      mode: 0o600,
    })
    return report
  } catch (error) {
    if (error instanceof OpenAiResponseError)
      providerRequestId = error.providerRequestId
    if (paid && settle && error instanceof OpenAiOutputError) {
      usage = {
        input_tokens: error.inputTokens,
        output_tokens: error.outputTokens,
      }
      const micros = pricedUsage(usage.input_tokens, usage.output_tokens)
      actual = micros / 1_000_000
      try {
        await settle(micros)
      } catch {
        // The run log retains metered cost even if the monthly entry needs reconciliation.
      }
    }
    const blockedBeforeInference = paid && !settle
    await writeFile(
      ledger,
      JSON.stringify({
        status: blockedBeforeInference
          ? 'blocked_before_inference'
          : actual === null
            ? 'failed_usage_unknown'
            : 'failed_usage_known',
        ...runMetadata,
        actual_cost: blockedBeforeInference ? 0 : actual,
        ...usage,
        ...(providerRequestId
          ? { provider_request_id: providerRequestId }
          : {}),
        ...(error instanceof OpenAiRequestError
          ? { provider_http_status: error.httpStatus, ...error.details }
          : {}),
      }) + '\n',
      { mode: 0o600 },
    )
    throw error
  }
}
