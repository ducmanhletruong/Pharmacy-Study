import { open, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { bundleSchema } from './index'

export const DEFAULT_MAX_IMPORT_BYTES = 5 * 1024 * 1024
export function importByteLimit(value?: string) {
  const limit = value === undefined ? DEFAULT_MAX_IMPORT_BYTES : Number(value)
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50 * 1024 * 1024)
    throw new Error('MAX_IMPORT_BYTES must be an integer from 1 to 52428800')
  return limit
}
export async function validateBundleFile(
  filePath: string,
  maxBytes = importByteLimit(process.env.MAX_IMPORT_BYTES),
) {
  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 1 ||
    maxBytes > 50 * 1024 * 1024
  )
    throw new Error('Invalid import byte limit')
  const initial = await stat(filePath)
  if (!initial.isFile()) throw new Error('Bundle input must be a regular file')
  if (initial.size > maxBytes)
    throw new Error('Bundle exceeds MAX_IMPORT_BYTES')
  const handle = await open(filePath, 'r')
  try {
    const opened = await handle.stat()
    if (!opened.isFile()) throw new Error('Bundle input must be a regular file')
    if (opened.size > maxBytes)
      throw new Error('Bundle exceeds MAX_IMPORT_BYTES')
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      const buffer = new Uint8Array(Math.min(65536, maxBytes - size + 1))
      const { bytesRead } = await handle.read(buffer)
      if (!bytesRead) break
      size += bytesRead
      if (size > maxBytes) throw new Error('Bundle exceeds MAX_IMPORT_BYTES')
      chunks.push(buffer.subarray(0, bytesRead))
    }
    const bytes = Buffer.concat(chunks)
    let value: unknown
    try {
      value = JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      )
    } catch {
      throw new Error('Bundle input must be valid UTF-8 JSON')
    }
    return bundleSchema.parse(value)
  } finally {
    await handle.close()
  }
}

async function main() {
  try {
    if (process.argv.length !== 3)
      throw new Error('Usage: pnpm content:validate <bundle.json>')
    const bundle = await validateBundleFile(resolve(process.argv[2]!))
    console.log(
      JSON.stringify(
        {
          valid: true,
          schema_version: bundle.schema_version,
          subject: bundle.manifest.subject,
          counts: {
            topics: bundle.topics.length,
            sources: bundle.sources.length,
            assets: bundle.assets.length,
            questions: bundle.questions.length,
          },
          inference_performed: false,
          external_api_calls: 0,
        },
        null,
        2,
      ),
    )
  } catch (error) {
    if (error && typeof error === 'object' && 'issues' in error)
      console.error(
        JSON.stringify({
          valid: false,
          error: 'bundle_invalid',
          issues: (
            error as { issues: { path: PropertyKey[]; message: string }[] }
          ).issues
            .slice(0, 30)
            .map((issue) => ({
              path: issue.path.map(String).join('.'),
              message: issue.message,
            })),
        }),
      )
    else if (error && typeof error === 'object' && 'code' in error)
      console.error(
        JSON.stringify({
          valid: false,
          error: 'bundle_unreadable',
          code: String(error.code),
        }),
      )
    else
      console.error(
        JSON.stringify({
          valid: false,
          error:
            error instanceof Error ? error.message : 'Bundle validation failed',
        }),
      )
    process.exitCode = 2
  }
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  await main()
