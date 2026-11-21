import { bundleQuestionSchema } from '@pharmacy/api-contract/bundle'
import type { Source } from '../knowledge'
export type Generated = {
  questions: unknown[]
  input_tokens: number
  output_tokens: number
}
export interface LlmProvider {
  readonly name: string
  readonly model: string
  generate(
    system: string,
    data: string,
    signal: AbortSignal,
  ): Promise<Generated>
}
export type Citation = { source_ref: string; quote: string }
export function validateGenerated(raw: unknown) {
  if (!raw || typeof raw !== 'object') throw Error('Invalid generation output')
  const items = (raw as { questions?: unknown }).questions
  if (!Array.isArray(items) || !items.length || items.length > 100)
    throw Error('Expected 1..100 generated MCQs')
  return items.map((item: unknown) => {
    if (!item || typeof item !== 'object') throw Error('Invalid MCQ')
    const { citations, ...question } = item as Record<string, unknown>
    if (!Array.isArray(citations) || !citations.length || citations.length > 20)
      throw Error('Missing citations')
    const checked: Citation[] = citations.map((c: unknown) => {
      if (!c || typeof c !== 'object') throw Error('Invalid citation')
      const value = c as Record<string, unknown>
      if (
        Object.keys(value).sort().join(',') !== 'quote,source_ref' ||
        typeof value.source_ref !== 'string' ||
        typeof value.quote !== 'string' ||
        !value.quote.trim() ||
        value.quote.length > 4000
      )
        throw Error('Invalid citation')
      return { source_ref: value.source_ref, quote: value.quote }
    })
    return {
      question: bundleQuestionSchema.parse(question),
      citations: checked,
    }
  })
}
export async function generateBounded(
  provider: LlmProvider,
  system: string,
  data: string,
  options: { timeout_ms: number; retries: number },
) {
  if (
    !Number.isInteger(options.retries) ||
    options.retries < 0 ||
    options.retries > 2 ||
    !Number.isFinite(options.timeout_ms) ||
    options.timeout_ms < 1 ||
    options.timeout_ms > 120000
  )
    throw Error('Invalid timeout/retry policy')
  // Retrying a paid request can incur another charge. The runner must reserve
  // the maximum for every attempt, including errors with unknown usage.
  let last: unknown
  for (let i = 0; i <= options.retries; i++) {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      const result = await Promise.race([
        provider.generate(system, data, controller.signal),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            controller.abort()
            reject(Error('Generation timed out'))
          }, options.timeout_ms)
        }),
      ])
      for (const count of [result.input_tokens, result.output_tokens])
        if (!Number.isSafeInteger(count) || count < 0)
          throw Error('Missing provider usage')
      validateGenerated({ questions: result.questions })
      return result
    } catch (error) {
      last = error
    } finally {
      if (timer) clearTimeout(timer)
    }
  }
  throw last
}
export function sourceData(sources: Source[], subject: string, topic: string) {
  return JSON.stringify({ subject, topic, sources })
}
