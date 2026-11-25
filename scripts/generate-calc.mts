import { parseArgs } from 'node:util'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  calcBundle,
  verifyCalcBundle,
} from '../packages/content-pipeline/src/types/calc'
import { families, type Family } from '../packages/calc-engine/src'
async function readEvidence(path: string) {
  const info = await stat(path)
  if (!info.isFile() || info.size > 5 * 1024 * 1024)
    throw Error('Invalid calculation evidence file')
  const bytes = await readFile(path)
  if (bytes.length > 5 * 1024 * 1024)
    throw Error('Invalid calculation evidence file')
  return bytes
}

async function main() {
  const { values: v } = parseArgs({
    options: {
      family: { type: 'string' },
      seed: { type: 'string' },
      subject: { type: 'string' },
      output: { type: 'string' },
      count: { type: 'string' },
      decimals: { type: 'string' },
      rounding: { type: 'string' },
      verify: { type: 'string' },
    },
  })
  if (v.verify) {
    if (
      v.family ||
      v.seed ||
      v.subject ||
      v.output ||
      v.rounding ||
      v.count ||
      v.decimals
    )
      throw Error('Choose generation or verification')
    const [bundle, manifest] = await Promise.all([
      readEvidence(join(v.verify, 'bundle.json')),
      readEvidence(join(v.verify, 'calculation-manifest.json')),
    ])
    console.log(
      JSON.stringify(
        verifyCalcBundle(bundle, JSON.parse(manifest.toString('utf8'))),
      ),
    )
    return
  }
  if (
    !v.family ||
    !families.includes(v.family as Family) ||
    !v.seed ||
    !v.subject ||
    !v.output
  )
    throw Error('Required: --family --seed --subject --output')
  const rounding =
    v.rounding ?? (v.subject === 'hpt1' ? 'half-even' : undefined)
  if (
    rounding !== undefined &&
    rounding !== 'legacy' &&
    rounding !== 'half-even'
  )
    throw Error('Expected --rounding half-even or legacy')
  const result = calcBundle(
    {
      family: v.family as Family,
      decimals: Number(v.decimals ?? 3),
      tolerance: 1e-10,
      ...(rounding === 'half-even' ? { rounding } : {}),
    },
    v.seed,
    v.subject,
    Number(v.count ?? 5),
  )
  await mkdir(v.output)
  await writeFile(
    join(v.output, 'bundle.json'),
    JSON.stringify(result.bundle, null, 2) + '\n',
    { flag: 'wx' },
  )
  await writeFile(
    join(v.output, 'calculation-manifest.json'),
    JSON.stringify(result.calculation_manifest, null, 2) + '\n',
    { flag: 'wx' },
  )
  console.log(
    JSON.stringify({
      generated: result.bundle.questions.length,
      status: 'draft_requires_admin_review',
      family: v.family,
    }),
  )
}

main().catch(() => {
  console.error(
    'Calculation command failed. Check the arguments and bundle/manifest pair.',
  )
  process.exitCode = 1
})
