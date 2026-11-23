import { validateGenerated, type Generated, type LlmProvider } from './index'
export class OpenAiProvider implements LlmProvider {
  readonly name = 'openai'
  readonly model: string
  constructor(
    private options: {
      api_key: string
      model: string
      max_output_tokens: number
      billing_approved: boolean
    },
    private transport: typeof fetch = fetch,
  ) {
    if (
      !options.billing_approved ||
      !options.api_key.trim() ||
      !options.model.trim()
    )
      throw Error('OpenAI credential/model/billing authorization required')
    if (
      !Number.isInteger(options.max_output_tokens) ||
      options.max_output_tokens < 256 ||
      options.max_output_tokens > 16000
    )
      throw Error('Invalid output token cap')
    this.model = options.model
  }
  async generate(
    system: string,
    data: string,
    signal: AbortSignal,
  ): Promise<Generated> {
    const response = await this.transport(
      'https://api.openai.com/v1/responses',
      {
        method: 'POST',
        signal,
        redirect: 'error',
        headers: {
          Authorization: 'Bearer ' + this.options.api_key,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          store: false,
          instructions: system,
          input: [{ role: 'user', content: data }],
          max_output_tokens: this.options.max_output_tokens,
          text: { format: { type: 'json_object' } },
        }),
      },
    )
    if (!response.ok) {
      await response.body?.cancel()
      throw Error('OpenAI request failed: HTTP ' + response.status)
    }
    if (!response.body) throw Error('Empty OpenAI response')
    const reader = response.body.getReader(),
      chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        const part = await reader.read()
        if (part.done) break
        size += part.value.length
        if (size > 1024 * 1024) throw Error('OpenAI response exceeds limit')
        chunks.push(part.value)
      }
    } finally {
      await reader.cancel()
    }
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as {
      status?: string
      output?: { type?: string; content?: { type?: string; text?: string }[] }[]
      usage?: { input_tokens?: number; output_tokens?: number }
    }
    if (value.status !== 'completed' || !value.output || !value.usage)
      throw Error('Incomplete OpenAI output or missing usage')
    const content = value.output
      .filter((o) => o.type === 'message')
      .flatMap((o) => o.content ?? [])
    if (content.some((c) => c.type === 'refusal'))
      throw Error('OpenAI refused generation')
    const text = content
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text ?? '')
      .join('')
    const raw: unknown = JSON.parse(text)
    const checked = validateGenerated(raw)
    const result = {
      questions: checked.map((c) => ({
        ...c.question,
        citations: c.citations,
      })),
      input_tokens: value.usage.input_tokens!,
      output_tokens: value.usage.output_tokens!,
    }
    if (
      !Number.isSafeInteger(result.input_tokens) ||
      result.input_tokens < 0 ||
      !Number.isSafeInteger(result.output_tokens) ||
      result.output_tokens < 0
    )
      throw Error('Invalid provider usage')
    return result
  }
}
