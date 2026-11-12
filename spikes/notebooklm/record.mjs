import { createHash, randomUUID } from 'node:crypto'
import { readFile, realpath, rename, writeFile } from 'node:fs/promises'
import { isAbsolute, relative } from 'node:path'
import { pathToFileURL } from 'node:url'
import { validateCapture } from './validate.mjs'

const pendingDays =
  'Need five topics on each of at least three distinct observed days'
const day = (timestamp) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp))

export function appendBatch(capture, batch, now = Date.now()) {
  const existing = validateCapture(capture, now)
  if (existing.errors.some((error) => error !== pendingDays)) {
    throw new Error('Complete capture metadata and fix existing evidence first')
  }
  if (!Array.isArray(batch) || batch.length === 0 || batch.length > 5) {
    throw new Error('Provide one to five manually verified observations')
  }
  const additions = batch.map((item) => {
    if (
      typeof item?.excerpt !== 'string' ||
      !item.excerpt.trim() ||
      item.response_ok !== true ||
      item.grounded_verified !== true
    ) {
      throw new Error(
        'Require an excerpt and explicit successful grounding review',
      )
    }
    return {
      topic_id: item.topic_id,
      observed_at: item.observed_at,
      response_ok: true,
      grounded_verified: true,
      excerpt_sha256: createHash('sha256')
        .update(item.excerpt, 'utf8')
        .digest('hex'),
      excerpt_chars: [...item.excerpt].length,
      citations: Array.isArray(item.citations)
        ? item.citations.map((citation) => ({
            source_ref: citation?.source_ref,
            location: citation?.location,
          }))
        : [],
    }
  })
  const result = {
    ...capture,
    observations: [...(capture.observations ?? []), ...additions],
  }
  const report = validateCapture(result, now)
  if (report.errors.some((error) => error !== pendingDays)) {
    throw new Error(
      'Invalid observation: check topic, actual time and source locator',
    )
  }
  const keys = result.observations.map(
    (item) => `${item.topic_id}:${day(item.observed_at)}`,
  )
  if (new Set(keys).size !== keys.length) {
    throw new Error('Already recorded this topic on this Vietnam calendar day')
  }
  return result
}

async function privateFile(path) {
  const root = await realpath(new URL('./private/', import.meta.url))
  const resolved = await realpath(path)
  const child = relative(root, resolved)
  if (
    !child ||
    child === '..' ||
    child.startsWith('../') ||
    child.startsWith('..\\') ||
    isAbsolute(child)
  ) {
    throw new Error('Both JSON files must be inside spikes/notebooklm/private')
  }
  return resolved
}

async function readJson(path) {
  const text = await readFile(path, 'utf8')
  try {
    // PowerShell can write a UTF-8 BOM; do not include parse snippets in errors.
    return JSON.parse(text.replace(/^\uFEFF/, ''))
  } catch {
    throw new Error(
      'Invalid JSON file; inspect it locally, do not paste private text',
    )
  }
}

async function main() {
  if (process.argv.length !== 4) {
    throw new Error(
      'Usage: node record.mjs <private-capture.json> <private-batch.json>',
    )
  }
  const capturePath = await privateFile(process.argv[2])
  const batchPath = await privateFile(process.argv[3])
  if (capturePath === batchPath)
    throw new Error('Use separate capture and batch files')
  const capture = await readJson(capturePath)
  const batch = await readJson(batchPath)
  const updated = appendBatch(capture, batch)
  const temporary = `${capturePath}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(updated, null, 2)}\n`, {
    encoding: 'utf8',
    flag: 'wx',
    mode: 0o600,
  })
  await rename(temporary, capturePath)
  const report = validateCapture(updated)
  console.log(JSON.stringify({ added_count: batch.length, ...report }, null, 2))
  if (!report.gate_passed) process.exitCode = 2
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch((error) => {
    console.error(
      error.code ? `File operation failed (${error.code})` : error.message,
    )
    process.exitCode = 1
  })
}
