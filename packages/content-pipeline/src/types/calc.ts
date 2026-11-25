import { isDeepStrictEqual } from 'node:util'
import { generate, maxSeedLength, type Template } from '@pharmacy/calc-engine'
import { bundleSchema } from '@pharmacy/api-contract/bundle'
import { sha256 } from '../bundle'
export function calcBundle(
  template: Template,
  seed: string,
  subject: string,
  count = 1,
) {
  if (!Number.isInteger(count) || count < 1 || count > 20)
    throw Error('Expected 1..20 examples')
  if (!seed.length || seed.length > maxSeedLength) throw Error('Invalid seed')
  const examples = [],
    stems = new Set<string>()
  for (let i = 0; i < count; i++) {
    let example
    for (let retry = 0; retry < 100; retry++) {
      const exampleSeed = `${seed}:${i}:${retry}`
      const candidate = generate(
        template,
        exampleSeed.length > maxSeedLength ? sha256(exampleSeed) : exampleSeed,
      )
      if (!stems.has(candidate.stem)) {
        example = candidate
        break
      }
    }
    if (!example) throw Error('Insufficient distinct parameter samples')
    stems.add(example.stem)
    examples.push(example)
  }
  const bundle = bundleSchema.parse({
    schema_version: 1,
    manifest: {
      subject,
      label:
        'P07 synthetic calculation examples — administrator review required',
      generator: {
        name: 'pharmacy-calc-engine',
        version: template.rounding === 'half-even' ? '2' : '1',
      },
      created_at: new Date().toISOString(),
    },
    topics: [
      {
        code: 'calc-example',
        parent_code: null,
        title: 'Bài tính ví dụ tổng hợp',
        sort_order: 0,
      },
    ],
    sources: [
      {
        ref: 'calc-example',
        kind: 'manual',
        title: 'Self-authored synthetic calculation template',
        locator: template.family,
        license: 'CC0-1.0 — synthetic example only',
        retrieved_at: new Date().toISOString(),
      },
    ],
    assets: [],
    questions: examples.map((e, i) => ({
      external_id: `calc-${sha256(seed).slice(0, 16)}-${i}`,
      type: 'mcq',
      difficulty: 1,
      topic_codes: ['calc-example'],
      stem: e.stem,
      explanation: e.explanation,
      choices: e.choices,
      sources: [
        {
          source_ref: 'calc-example',
          locator: `${template.family}; seed=${e.seed}; decimals=${template.decimals}`,
        },
      ],
    })),
  })
  return {
    bundle,
    calculation_manifest: {
      template,
      seed,
      examples,
      bundle_sha256: sha256(JSON.stringify(bundle, null, 2) + '\n'),
    },
  }
}

export function verifyCalcBundle(bytes: Uint8Array, rawManifest: unknown) {
  if (!rawManifest || typeof rawManifest !== 'object')
    throw Error('Invalid calculation manifest')
  const manifest = rawManifest as Partial<
    ReturnType<typeof calcBundle>['calculation_manifest']
  >
  if (manifest.bundle_sha256 !== sha256(bytes))
    throw Error('Calculation bundle checksum mismatch')
  if (
    !manifest.template ||
    typeof manifest.seed !== 'string' ||
    !Array.isArray(manifest.examples)
  )
    throw Error('Invalid calculation manifest')

  const bundle = bundleSchema.parse(
    JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)),
  )
  // Regenerate the selected seeds. Each generated question checks the primary
  // calculation against the independent reference before formatting an answer.
  const expected = calcBundle(
    manifest.template,
    manifest.seed,
    bundle.manifest.subject,
    manifest.examples.length,
  )
  const expectedBundle = expected.bundle
  // Generation timestamps vary between runs. All other bundle fields,
  // including the topic and source license, must reproduce from the template.
  expectedBundle.manifest.created_at = bundle.manifest.created_at
  expectedBundle.sources[0]!.retrieved_at =
    bundle.sources[0]?.retrieved_at ?? expectedBundle.sources[0]!.retrieved_at
  if (
    !isDeepStrictEqual(bundle, expectedBundle) ||
    !isDeepStrictEqual(
      manifest.examples,
      expected.calculation_manifest.examples,
    )
  )
    throw Error('Calculation bundle or evidence do not reproduce')

  return {
    verified: bundle.questions.length,
    subject: bundle.manifest.subject,
    family: manifest.template.family,
    rounding: manifest.template.rounding ?? 'legacy',
    bundle_sha256: manifest.bundle_sha256,
  }
}
