import { randomUUID } from 'node:crypto'
import {
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rmdir,
  writeFile,
} from 'node:fs/promises'
import { join } from 'node:path'

export const paidModel = 'gpt-6.2-sol'
export const batchCapMicros = 500_000
export const monthlyCapMicros = 40_000_000
export const smokeOutputCap = 4096

// Short-context Standard text rates in micro-USD per token.
const inputRate = 2,
  outputRate = 10
export function pricedUsage(input: number, output: number) {
  if (
    !Number.isSafeInteger(input) ||
    input < 0 ||
    !Number.isSafeInteger(output) ||
    output < 0
  )
    throw Error('Invalid metered tokens')
  // Long-context list rules apply to the full request when this threshold is exceeded.
  return input > 272_000
    ? input * 4 + output * 15
    : input * inputRate + output * outputRate
}

export function estimateSmokeCost(prompt: string, data: string) {
  // UTF-8 byte length is intentionally conservative for short text and leaves
  // room for provider message framing. No images, tools or cached-rate credit.
  const upperInput =
    Buffer.byteLength(JSON.stringify([prompt, data]), 'utf8') + 4096
  if (upperInput > 100_000) throw Error('Live pilot payload is too large')
  return pricedUsage(upperInput, smokeOutputCap)
}

function localMonth(now: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(now)
  return (
    parts.find((part) => part.type === 'year')!.value +
    '-' +
    parts.find((part) => part.type === 'month')!.value
  )
}

type Entry = { reserved_micros: number; actual_micros: number | null }

export async function reserveBudget(
  directory: string,
  estimate: number,
  batchLimit: number,
  now = new Date(),
) {
  if (
    !Number.isSafeInteger(estimate) ||
    estimate < 1 ||
    !Number.isSafeInteger(batchLimit) ||
    batchLimit < 1 ||
    batchLimit > batchCapMicros ||
    estimate > batchLimit
  )
    throw Error('Batch spending limit exceeded')
  const root = await realpath(directory)
  const month = localMonth(now)
  const lock = join(root, `.${month}.lock`)
  await mkdir(lock, { mode: 0o700 })
  let filename: string
  try {
    let reserved = 0
    for (const file of await readdir(root, { withFileTypes: true })) {
      const name = file.name
      if (!name.startsWith(month + '-') || !name.endsWith('.json')) continue
      if (!file.isFile()) throw Error('Invalid ledger entry path')
      const entry = JSON.parse(
        await readFile(join(root, name), 'utf8'),
      ) as Entry
      if (
        !Number.isSafeInteger(entry.reserved_micros) ||
        entry.reserved_micros < 1 ||
        (entry.actual_micros !== null &&
          (!Number.isSafeInteger(entry.actual_micros) ||
            entry.actual_micros < 0))
      )
        throw Error('Invalid budget ledger')
      reserved += entry.actual_micros ?? entry.reserved_micros
    }
    if (reserved + estimate > monthlyCapMicros)
      throw Error('Monthly spending limit exceeded')
    filename = join(root, `${month}-${randomUUID()}.json`)
    await writeFile(
      filename,
      JSON.stringify({ reserved_micros: estimate, actual_micros: null }) + '\n',
      { flag: 'wx', mode: 0o600 },
    )
  } finally {
    await rmdir(lock)
  }
  return async (actual: number) => {
    if (!Number.isSafeInteger(actual) || actual < 0)
      throw Error('Invalid settled spending')
    const temporary = filename + '.' + randomUUID() + '.tmp'
    await writeFile(
      temporary,
      JSON.stringify({ reserved_micros: estimate, actual_micros: actual }) +
        '\n',
      { flag: 'wx', mode: 0o600 },
    )
    await rename(temporary, filename)
    if (actual > estimate)
      throw Error('Recorded usage exceeded the reserved estimate')
  }
}
