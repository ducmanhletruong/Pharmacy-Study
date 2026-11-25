import { validateAsset } from '../../db/src/asset-safety'

type Molecule = {
  get_svg(width: number, height: number): string
  delete(): void
}
export type RdkitRenderer = { get_mol(smiles: string): Molecule | null }

const presentation = new Set([
  'fill',
  'fill-rule',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'opacity',
])

function rdkitPresentation(svg: string): string {
  // RDKit emits a small fixed SVG dialect. The general asset validator still
  // parses and checks the resulting XML, including every presentation value.
  return svg
    .replace(/^<\?xml\s+[^?]*\?>\s*/u, '')
    .replace(/<!--[\s\S]*?-->/gu, '')
    .replace(
      /\s(?:xmlns:rdkit|xmlns:xlink|xml:space|baseProfile|version|class)=(["'])[^"'<>]*\1/gu,
      '',
    )
    .replace(/\sstyle=(["'])([^"'<>]*)\1/gu, (_match, _quote, body: string) => {
      const fields = new Map<string, string>()
      for (const entry of body.split(';').filter((part) => part.trim())) {
        const [name, value, ...rest] = entry
          .split(':')
          .map((part) => part.trim())
        if (
          !name ||
          !value ||
          rest.length ||
          !presentation.has(name) ||
          fields.has(name)
        )
          throw Error('Unsupported RDKit presentation')
        fields.set(
          name,
          name === 'stroke-width' ? value.replace(/px$/u, '') : value,
        )
      }
      return [...fields].map(([key, value]) => ` ${key}="${value}"`).join('')
    })
}

export async function renderChemicalSvg(rdkit: RdkitRenderer, smiles: string) {
  if (
    !smiles.trim() ||
    smiles.length > 2048 ||
    /[\u0000-\u001f\u007f]/u.test(smiles)
  )
    throw Error('Invalid SMILES')
  const molecule = rdkit.get_mol(smiles)
  if (!molecule) throw Error('Invalid SMILES')
  try {
    const raw = molecule.get_svg(360, 240)
    if (Buffer.byteLength(raw) > 2 * 1024 * 1024)
      throw Error('Rendered image exceeds asset limits')
    return await validateAsset({
      kind: 'svg',
      data_base64: Buffer.from(rdkitPresentation(raw)).toString('base64'),
      license: 'project-authored',
      attribution: 'Rendered from a structure with RDKit',
      alt_text: 'Sơ đồ liên kết của hợp chất trong câu hỏi',
    })
  } finally {
    molecule.delete()
  }
}
