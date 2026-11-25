import { readFile, stat } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { extname } from 'node:path'

const yaml = createRequire(import.meta.url)('js-yaml') as {
  JSON_SCHEMA: object
  load(source: string, options: { schema: object; maxDepth: number }): unknown
}

export async function readTaxonomyFile(path: string): Promise<unknown> {
  const info = await stat(path)
  if (!info.isFile() || info.size > 2 * 1024 * 1024)
    throw Error('Taxonomy file exceeds limits')
  const contents = await readFile(path, 'utf8')
  const extension = extname(path).toLowerCase()
  return extension === '.yaml' || extension === '.yml'
    ? yaml.load(contents, { schema: yaml.JSON_SCHEMA, maxDepth: 8 })
    : (JSON.parse(contents) as unknown)
}
