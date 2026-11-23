import { readAuthConfig } from '../../config'
import { PracticeError } from '@pharmacy/db/practice'
export async function readBody(
  request: Request,
  timeoutMs = 10000,
  maxBytes = readAuthConfig().MAX_BODY_BYTES,
) {
  const maxBodyBytes = maxBytes
  if (Number(request.headers.get('content-length') ?? 0) > maxBodyBytes)
    throw new PracticeError('payload_too_large', 413, 'Nội dung quá lớn')
  if (!request.body) return ''
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = []
  let size = 0
  const deadline = Date.now() + timeoutMs
  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const timedOut = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => {
            reject(
              new PracticeError(
                'request_timeout',
                408,
                'Gửi dữ liệu quá chậm. Vui lòng thử lại.',
              ),
            )
            void reader.cancel().catch(() => {})
          },
          Math.max(1, deadline - Date.now()),
        )
      })
      let chunk: ReadableStreamReadResult<Uint8Array>
      try {
        chunk = await Promise.race([reader.read(), timedOut])
      } finally {
        clearTimeout(timer)
      }
      const { done, value } = chunk
      if (done) break
      size += value.byteLength
      if (size > maxBodyBytes) {
        await reader.cancel()
        throw new PracticeError('payload_too_large', 413, 'Nội dung quá lớn')
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new PracticeError('validation_failed', 400, 'Nội dung phải là UTF-8')
  }
}
