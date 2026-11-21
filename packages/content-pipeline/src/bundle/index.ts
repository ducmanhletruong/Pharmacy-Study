import { createHash, randomUUID } from 'node:crypto'
import { mkdir, writeFile, rename, unlink, rmdir } from 'node:fs/promises'
import { resolve, dirname, basename, join } from 'node:path'
import { bundleSchema } from '@pharmacy/api-contract/bundle'

export const sha256 = (value: string) =>
  createHash('sha256').update(value).digest('hex')
export type ProvenanceInput = {
  model: string
  provider: string
  prompt_version: string
  prompt: string
  sources: { ref: string; text: string }[]
}
export function prepareBundle(raw: unknown, input: ProvenanceInput) {
  const bundle = bundleSchema.parse(raw)
  for (const value of [
    input.model,
    input.provider,
    input.prompt_version,
    input.prompt,
  ])
    if (!value.trim()) throw new Error('Missing generation provenance')
  const refs = new Set(input.sources.map((s) => s.ref))
  if (
    refs.size !== input.sources.length ||
    bundle.sources.some((s) => !refs.has(s.ref))
  )
    throw new Error('Missing or duplicate source provenance')
  const json = JSON.stringify(bundle, null, 2) + '\n'
  return {
    bundle,
    json,
    provenance: {
      schema_version: 1,
      bundle_sha256: sha256(json),
      provider: input.provider,
      model: input.model,
      prompt_version: input.prompt_version,
      prompt_sha256: sha256(input.prompt),
      sources: input.sources.map((s) => ({
        ref: s.ref,
        sha256: sha256(s.text),
      })),
      review_status: 'draft_requires_admin_review' as const,
    },
  }
}
// Reserve a new output directory; never overwrite an earlier run.
export async function writeBundle(
  output: string,
  raw: unknown,
  input: ProvenanceInput,
) {
  const result = prepareBundle(raw, input)
  const target = resolve(output)
  const temporary = join(
    dirname(target),
    '.' + basename(target) + '-' + randomUUID(),
  )
  await mkdir(temporary, { mode: 0o700 })
  try {
    await writeFile(join(temporary, 'bundle.json'), result.json, {
      flag: 'wx',
      mode: 0o600,
    })
    await writeFile(
      join(temporary, 'provenance.json'),
      JSON.stringify(result.provenance, null, 2) + '\n',
      { flag: 'wx', mode: 0o600 },
    )
    // mkdir is the no-clobber reservation; a failed rename cannot destroy a run.
    await mkdir(target)
    try {
      await rename(join(temporary, 'bundle.json'), join(target, 'bundle.json'))
      await rename(
        join(temporary, 'provenance.json'),
        join(target, 'provenance.json'),
      )
    } catch (error) {
      throw new Error('Incomplete output directory; inspect before retry', {
        cause: error,
      })
    }
    return result.provenance
  } finally {
    for (const name of ['bundle.json', 'provenance.json'])
      await unlink(join(temporary, name)).catch(
        (error: NodeJS.ErrnoException) => {
          if (error.code !== 'ENOENT') throw error
        },
      )
    await rmdir(temporary)
  }
}
