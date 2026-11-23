import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = fileURLToPath(new URL('../', import.meta.url))
export async function verifyGlobHardening() {
  const policy = JSON.parse(
    await readFile(
      join(root, 'docs/security/picomatch-mitigation.json'),
      'utf8',
    ),
  )
  assert.equal(policy.advisory, 'GHSA-fc5q-39xc-vjpf')
  const req = createRequire(new URL('../package.json', import.meta.url))
  const v4 = createRequire(req.resolve('vitest')).resolve('picomatch')
  let v2 = req.resolve('eslint-config-next')
  for (const dependency of [
    '@next/eslint-plugin-next',
    'fast-glob',
    'micromatch',
    'picomatch',
  ])
    v2 = createRequire(v2).resolve(dependency)
  const versions = []
  for (const file of [v2, v4]) {
    const metadata = JSON.parse(
      await readFile(join(dirname(file), 'package.json'), 'utf8'),
    )
    const version = metadata.version
    assert.ok(
      ['2.3.2', '4.0.7'].includes(version),
      'Review dependency versions before accepting a mitigation',
    )
    const patch = policy.patches[version]
    assert.equal(patch.file, `patches/picomatch@${version}.patch`)
    assert.equal(
      createHash('sha256')
        .update(await readFile(join(root, patch.file)))
        .digest('hex'),
      patch.sha256,
      'Security patch checksum changed',
    )
    const source = await readFile(join(dirname(file), 'lib/parse.js'), 'utf8')
    assert.ok(source.includes("type === 'plus' || type === 'star'"))
    const probe = spawnSync(
      process.execPath,
      [
        '-e',
        String.raw`
   const assert=require('node:assert/strict');const pm=require(process.argv[1]);
   for(const pattern of ['+(*)','+(*a)','*(*)','*(*a)','!(+(*a))','+(a|*)']) {
    assert.throws(()=>pm(pattern)('a'.repeat(50)+'!'), error=>error instanceof SyntaxError&&error.message.includes('Repeated extglobs are disabled'));
   }
   assert.equal(pm('**/*.ts')('src/index.ts'),true);
   assert.equal(pm('@(src|test)/**/*.ts')('src/lib/index.ts'),true);
   assert.equal(pm('src/**/!(*.test).ts')('src/lib/index.ts'),true);
  `,
        file,
      ],
      { encoding: 'utf8', timeout: 2000, killSignal: 'SIGKILL' },
    )
    assert.equal(
      probe.status,
      0,
      `Isolated ReDoS/compatibility probe failed for ${version}: ${probe.error?.code ?? probe.stderr}`,
    )
    versions.push(version)
  }
  return versions
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  console.log(
    JSON.stringify({
      mitigated: 'GHSA-fc5q-39xc-vjpf',
      verified_versions: await verifyGlobHardening(),
      isolated_timeout_ms: 2000,
    }),
  )
}
