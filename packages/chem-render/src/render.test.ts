import { expect, test, vi } from 'vitest'
import { renderChemicalSvg } from './render'

const sample = `<?xml version='1.0' encoding='iso-8859-1'?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:rdkit="http://www.rdkit.org/xml" fill="none" width="360px" height="240px">
<!-- header -->
<path class="bond-0" d="M 10,10 L 20,20" style="stroke:#000000;stroke-width:2px;fill:none" />
</svg>`

test('RDKit SVG normalization is deterministic and uses the P04 asset gate', async () => {
  const release = vi.fn()
  const adapter = {
    get_mol: () => ({ get_svg: () => sample, delete: release }),
  }
  const first = await renderChemicalSvg(adapter, 'CC')
  expect(first.sha256).toBe((await renderChemicalSvg(adapter, 'CC')).sha256)
  expect(first.data.toString()).toContain('stroke-width="2"')
  expect(first.data.toString()).not.toContain('xmlns:rdkit')
  expect(release).toHaveBeenCalledTimes(2)
  await expect(
    renderChemicalSvg({ get_mol: () => null }, 'not-an-input'),
  ).rejects.toThrow('Invalid SMILES')
  await expect(
    renderChemicalSvg(
      {
        get_mol: () => ({
          get_svg: () => sample.replace('</svg>', '<script/></svg>'),
          delete: release,
        }),
      },
      'CC',
    ),
  ).rejects.toThrow('Invalid asset')
  expect(release).toHaveBeenCalledTimes(3)
})
