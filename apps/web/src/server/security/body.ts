import { readAuthConfig } from '../../config'
import { PracticeError } from '@pharmacy/db/practice'
export async function readBody(request: Request) {
  const maxBodyBytes = readAuthConfig().MAX_BODY_BYTES
  if (Number(request.headers.get('content-length') ?? 0) > maxBodyBytes)
    throw new PracticeError('payload_too_large', 413, 'Nội dung quá lớn')
  if (!request.body) return ''
  const reader = request.body.getReader(),
    chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
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
