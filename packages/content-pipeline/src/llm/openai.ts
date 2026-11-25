import { generatedItems, type Generated, type LlmProvider } from './index'

function requiredObject(properties: Record<string, object>) {
  return {
    type: 'object',
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  }
}

const text = { type: 'string' }
const questionFormat = {
  type: 'json_schema',
  name: 'draft_mcq_batch',
  strict: true,
  schema: requiredObject({
    questions: {
      type: 'array',
      items: requiredObject({
        external_id: text,
        type: { type: 'string', enum: ['mcq'] },
        difficulty: { type: 'integer', enum: [1, 2, 3] },
        stem: text,
        choices: {
          type: 'array',
          items: requiredObject({
            label: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
            text,
            is_correct: { type: 'boolean' },
          }),
        },
        explanation: text,
        topic_codes: { type: 'array', items: text },
        sources: {
          type: 'array',
          items: requiredObject({ source_ref: text, locator: text }),
        },
        citations: {
          type: 'array',
          items: requiredObject({ source_ref: text, quote: text }),
        },
      }),
    },
  }),
}

type RequestDetails = {
  provider_request_id?: string
  provider_error_code?: string
  provider_error_param?: string
}

const errorCodes = new Set([
  'context_length_exceeded',
  'insufficient_quota',
  'invalid_api_key',
  'invalid_json',
  'invalid_json_schema',
  'invalid_type',
  'invalid_value',
  'missing_required_parameter',
  'model_not_found',
  'rate_limit_exceeded',
  'unsupported_parameter',
  'unsupported_value',
])
const requestParam =
  /^(?:model|instructions|input|service_tier|store|max_output_tokens|text|reasoning)(?:(?:\[\d{1,3}\])|\.(?:role|content|type|text|format|name|strict|schema|effort))*$/

async function readJson(
  response: Response,
  maxBytes: number,
  signal: AbortSignal,
): Promise<unknown> {
  if (!response.body) throw Error('Empty OpenAI response')
  const reader = response.body.getReader()
  const cancel = () => {
    void reader.cancel().catch(() => undefined)
  }
  signal.addEventListener('abort', cancel, { once: true })
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    signal.throwIfAborted()
    while (true) {
      const part = await reader.read()
      if (part.done) break
      size += part.value.length
      if (size > maxBytes) throw Error('OpenAI response exceeds limit')
      chunks.push(part.value)
    }
    signal.throwIfAborted()
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  } finally {
    signal.removeEventListener('abort', cancel)
    cancel()
  }
}

function providerRequestId(response: Response) {
  const id = response.headers.get('x-request-id')
  return id && /^req_[a-f0-9]{32}$/i.test(id) ? id : undefined
}

async function requestDetails(
  response: Response,
  signal: AbortSignal,
): Promise<RequestDetails> {
  const requestId = providerRequestId(response)
  const diagnosticSignal = AbortSignal.any([signal, AbortSignal.timeout(1000)])
  const body = (await readJson(response, 16 * 1024, diagnosticSignal).catch(
    () => undefined,
  )) as { error?: { code?: unknown; param?: unknown } } | undefined
  const code = body?.error?.code
  const param = body?.error?.param
  // Error messages and unknown fields may echo request data.
  return {
    ...(requestId ? { provider_request_id: requestId } : {}),
    ...(typeof code === 'string' && errorCodes.has(code)
      ? { provider_error_code: code }
      : {}),
    ...(typeof param === 'string' &&
    param.length <= 100 &&
    requestParam.test(param)
      ? { provider_error_param: param }
      : {}),
  }
}

export class OpenAiRequestError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly details: RequestDetails = {},
  ) {
    super('OpenAI request failed')
  }
}
export class OpenAiResponseError extends Error {
  constructor(
    message: string,
    readonly providerRequestId?: string,
  ) {
    super(message)
  }
}

export class OpenAiOutputError extends OpenAiResponseError {
  constructor(
    readonly inputTokens: number,
    readonly outputTokens: number,
    providerRequestId?: string,
  ) {
    super('OpenAI returned unusable generation output', providerRequestId)
  }
}
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
    clientRequestId?: string,
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
          ...(clientRequestId
            ? { 'X-Client-Request-Id': clientRequestId }
            : {}),
        },
        body: JSON.stringify({
          model: this.model,
          service_tier: 'default',
          store: false,
          input: [
            { role: 'developer', content: system },
            { role: 'user', content: data },
          ],
          max_output_tokens: this.options.max_output_tokens,
          text: { format: questionFormat },
        }),
      },
    )
    if (!response.ok) {
      throw new OpenAiRequestError(
        response.status,
        await requestDetails(response, signal),
      )
    }
    const requestId = providerRequestId(response)
    const value = (await readJson(response, 1024 * 1024, signal).catch(() => {
      throw new OpenAiResponseError('Invalid OpenAI response body', requestId)
    })) as {
      status?: string
      output?: { type?: string; content?: { type?: string; text?: string }[] }[]
      usage?: { input_tokens?: number; output_tokens?: number }
    } | null
    const input = value?.usage?.input_tokens,
      output = value?.usage?.output_tokens
    if (
      typeof input !== 'number' ||
      !Number.isSafeInteger(input) ||
      input < 0 ||
      typeof output !== 'number' ||
      !Number.isSafeInteger(output) ||
      output < 0
    )
      throw new OpenAiResponseError('Invalid provider usage', requestId)
    try {
      if (value?.status !== 'completed' || !Array.isArray(value.output))
        throw Error('Incomplete provider output')
      const content = value.output
        .filter((o) => o.type === 'message')
        .flatMap((o) => o.content ?? [])
      if (content.some((c) => c.type === 'refusal'))
        throw Error('Provider refused generation')
      const text = content
        .filter((c) => c.type === 'output_text')
        .map((c) => c.text ?? '')
        .join('')
      return {
        questions: generatedItems(JSON.parse(text)),
        input_tokens: input,
        output_tokens: output,
        ...(requestId ? { provider_request_id: requestId } : {}),
      }
    } catch {
      throw new OpenAiOutputError(input, output, requestId)
    }
  }
}
