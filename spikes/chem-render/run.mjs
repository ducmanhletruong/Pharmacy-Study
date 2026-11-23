import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import initRDKit from '@rdkit/rdkit'

const fixtures = JSON.parse(
  await readFile(new URL('./molecules.json', import.meta.url), 'utf8'),
)

if (process.argv.includes('--worker')) {
  const start = performance.now()
  const rdkit = await initRDKit()
  const initMs = performance.now() - start
  const items = fixtures.map(({ id, smiles }) => {
    const started = performance.now()
    const molecule = rdkit.get_mol(smiles)
    assert.ok(molecule, `Invalid SMILES: ${id}`)
    try {
      const svg = molecule.get_svg(360, 240)
      assert.match(svg, /<svg[\s>]/)
      assert.match(svg, /<\/svg>/)
      assert.doesNotMatch(
        svg,
        /<script|<foreignObject|\bon\w+\s*=|(?:href|src)\s*=/i,
      )
      return {
        id,
        smiles,
        canonical_smiles: molecule.get_smiles(),
        svg_sha256: createHash('sha256').update(svg).digest('hex'),
        bytes: Buffer.byteLength(svg),
        render_ms: Number((performance.now() - started).toFixed(3)),
        svg,
      }
    } finally {
      molecule.delete()
    }
  })
  const invalid = rdkit.get_mol('not-a-valid-smiles')
  assert.equal(invalid, null, 'Invalid SMILES must be rejected')
  process.stdout.write(
    JSON.stringify({ rdkit_version: rdkit.version(), init_ms: initMs, items }),
  )
} else {
  const runs = [1, 2].map(() =>
    JSON.parse(
      execFileSync(
        process.execPath,
        [fileURLToPath(import.meta.url), '--worker'],
        {
          encoding: 'utf8',
          timeout: 30_000,
        },
      ),
    ),
  )
  const output = new URL('./artifacts/', import.meta.url)
  await mkdir(output, { recursive: true })
  const results = runs[0].items.map((item, index) => {
    const other = runs[1].items[index]
    assert.equal(item.svg_sha256, other.svg_sha256, `Unstable SVG: ${item.id}`)
    assert.equal(item.canonical_smiles, other.canonical_smiles)
    return { ...item, svg: undefined, repeat_render_ms: other.render_ms }
  })
  for (const item of runs[0].items) {
    await writeFile(new URL(`${item.id}.svg`, output), item.svg)
  }
  const report = {
    schema_version: 1,
    synthetic: true,
    observed_at: new Date().toISOString(),
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch,
    },
    rdkit_version: runs[0].rdkit_version,
    license: 'BSD-3-Clause',
    run_count: 2,
    independent_processes: true,
    molecule_count: results.length,
    identical_svg_count: results.length,
    invalid_smiles_rejected: true,
    initialization_ms: runs.map((run) => Number(run.init_ms.toFixed(3))),
    results,
    limitations: [
      'Node/WASM feasibility only; no browser, product sanitizer, nomenclature grading, or medical-content validation.',
      'Safety assertions inspect only these generated samples; they are not an SVG sanitizer.',
      'Timings apply to this executor; no p95 claim for other hardware or production.',
    ],
  }
  const reportPath = new URL('./report.json', import.meta.url)
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(
    `PASS: ${results.length}/10 SVG hashes identical across two processes; invalid SMILES rejected. Report: ${fileURLToPath(reportPath)}`,
  )
}
