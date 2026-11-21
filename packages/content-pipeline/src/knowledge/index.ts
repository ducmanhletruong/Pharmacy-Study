import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve, relative, isAbsolute } from 'node:path'
export type Source = {
  kind?: 'manual' | 'notebooklm'
  ref: string
  title: string
  locator: string
  license: string
  text: string
}
export interface KnowledgeSource {
  read(): Promise<Source[]>
}
const id = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/
export function validateSources(raw: unknown): Source[] {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 100)
    throw Error('Expected 1..100 sources')
  const refs = new Set<string>()
  let bytes = 0
  return raw.map((item) => {
    if (!item || typeof item !== 'object') throw Error('Invalid source')
    const value = item as Record<string, unknown>
    for (const key of ['ref', 'title', 'locator', 'license', 'text'])
      if (typeof value[key] !== 'string' || !(value[key] as string).trim())
        throw Error('Missing source ' + key)
    const source = value as Source
    if (!id.test(source.ref) || refs.has(source.ref))
      throw Error('Invalid or duplicate source ref')
    refs.add(source.ref)
    bytes += Buffer.byteLength(source.text)
    if (
      bytes > 2 * 1024 * 1024 ||
      source.title.length > 1000 ||
      source.locator.length > 2000 ||
      source.license.length > 2000
    )
      throw Error('Sources exceed limits')
    return {
      ref: source.ref,
      title: source.title,
      locator: source.locator,
      license: source.license,
      text: source.text,
    }
  })
}
export class LocalKnowledgeSource implements KnowledgeSource {
  constructor(private directory: string) {}
  async read() {
    const root = await realpath(this.directory)
    async function inside(path: string, maxBytes: number) {
      const file = await realpath(resolve(root, path))
      const rel = relative(root, file)
      if (
        isAbsolute(rel) ||
        rel === '..' ||
        rel.startsWith('..\\') ||
        rel.startsWith('../')
      )
        throw Error('Source path escapes root')
      const info = await stat(file)
      if (!info.isFile() || info.size > maxBytes)
        throw Error('Source file exceeds limits')
      return readFile(file, 'utf8')
    }
    const manifest: unknown = JSON.parse(
      await inside('sources.json', 128 * 1024),
    )
    if (
      !Array.isArray(manifest) ||
      manifest.length < 1 ||
      manifest.length > 100
    )
      throw Error('Invalid source manifest')
    const sources = []
    let remaining = 2 * 1024 * 1024
    for (const item of manifest) {
      if (!item || typeof item.file !== 'string')
        throw Error('Missing source file')
      const text = await inside(item.file, remaining)
      remaining -= Buffer.byteLength(text)
      sources.push({ ...item, text })
    }
    return validateSources(sources)
  }
}
