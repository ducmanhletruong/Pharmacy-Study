import { createHash } from 'node:crypto'
import { describe, expect, test } from 'vitest'
import sharp from 'sharp'
import { validateAsset, type AssetInput } from './asset-safety'

const svg = (body = '<path d="M0 0 L16 16" stroke="#123456" fill="none"/>') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16">${body}</svg>`
const asset = (
  data: string | Buffer,
  kind: AssetInput['kind'] = 'svg',
): AssetInput => ({
  kind,
  data_base64: Buffer.from(data).toString('base64'),
  license: 'CC0-1.0 (synthetic test fixture)',
  attribution: 'Synthetic test author',
  alt_text: 'Synthetic geometry',
})

describe('SVG asset safety', () => {
  test('keeps static geometry bytes and hashes exactly what will be stored', async () => {
    const source = svg(
      '<g transform="translate(1, 2) scale(0.5)"><rect x="0" y="0" width="8" height="8" fill="rgb(1,2,3)"/><circle cx="4" cy="4" r="2" fill="red"/></g>',
    )
    const result = await validateAsset(asset(source))
    expect(result).toMatchObject({
      mime: 'image/svg+xml',
      width: 16,
      height: 16,
    })
    expect(result.data.equals(Buffer.from(source))).toBe(true)
    expect(result.sha256).toBe(
      createHash('sha256').update(result.data).digest('hex'),
    )
  })
  test('allows finite viewBox dimensions when explicit pixel dimensions are omitted', async () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -2 20 30"><polyline points="0,0 1,1"/></svg>'
    expect(await validateAsset(asset(source))).toMatchObject({
      width: 20,
      height: 30,
    })
  })
  test.each([
    svg('<script>alert(1)</script>'),
    svg('<path d="M0 0" onload="alert(1)"/>'),
    svg(
      '<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>',
    ),
    '<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]>' + svg('&x;'),
    '<?xml-stylesheet href="https://example.invalid/a.css"?>' + svg(),
    '<?xml version="1.0"?>' + svg(),
    svg('<image href="https://example.invalid/image.png"/>'),
    svg('<use href="#shape"/>'),
    svg('<path href="javascript:alert(1)" d="M0 0"/>'),
    svg('<g xmlns="http://www.w3.org/1999/xhtml"><path d="M0 0"/></g>'),
    '<svg xmlns="http://www.w3.org/2000/svg" xmlns:x="https://example.invalid/ns" width="16" height="16"><x:path d="M0 0"/></svg>',
    svg('<style>path{fill:url(https://example.invalid)}</style>'),
    svg('<path style="fill:url(https://example.invalid)" d="M0 0"/>'),
    svg('<path fill="url(https://example.invalid/image.svg)" d="M0 0"/>'),
    svg('<path fill="&#x75;rl(https://example.invalid)" d="M0 0"/>'),
    svg('<path stroke="URL(#paint)" d="M0 0"/>'),
    svg('<path transform="translate(0,0);url(x)" d="M0 0"/>'),
    svg('<path d="M1e1000 0"/>'),
    svg('<text>not geometry</text>'),
    svg('<path d="M0 0"></g>'),
    svg('<path d="M0 0" d="M1 1"/>'),
    '<svg width="16" height="16"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="8193" height="1"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="4096" height="4096"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="16"/>',
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 0 10"/>',
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>',
  ])(
    'rejects active, external, malformed or unbounded SVG (%#)',
    async (source) => {
      await expect(validateAsset(asset(source))).rejects.toThrow(
        /^Invalid asset$/,
      )
    },
  )
  test('caps nesting and geometry count to bound downstream SVG rendering work', async () => {
    for (const body of [
      '<g>'.repeat(64) + '</g>'.repeat(64),
      '<path d="M0 0"/>'.repeat(10_000),
    ])
      await expect(validateAsset(asset(svg(body)))).rejects.toThrow(
        /^Invalid asset$/,
      )
  })
  test('rejects invalid UTF-8 instead of decoding replacement characters', async () => {
    const bytes = Buffer.concat([
      Buffer.from(svg().slice(0, -6)),
      Buffer.from([255]),
      Buffer.from('</svg>'),
    ])
    await expect(validateAsset(asset(bytes))).rejects.toThrow(/^Invalid asset$/)
  })
})

describe('base64 and metadata limits', () => {
  test.each([
    'Zg',
    'Zg===',
    'Zh==',
    ' Zg==',
    'Zg==\n',
    'data:image/png;base64,Zg==',
    '!!!!',
  ])('rejects non-canonical base64 (%#)', async (value) => {
    await expect(
      validateAsset({ ...asset(svg()), data_base64: value }),
    ).rejects.toThrow(/^Invalid asset$/)
  })
  test('rejects oversized encoded input before decoding', async () => {
    await expect(
      validateAsset({
        ...asset(svg()),
        data_base64: 'A'.repeat(4 * Math.ceil((2 * 1024 * 1024) / 3) + 4),
      }),
    ).rejects.toThrow(/^Invalid asset$/)
  })
  test('rejects decoded overflow even when encoded length is within the hard bound', async () => {
    const overflow = Buffer.alloc(2 * 1024 * 1024 + 1).toString('base64')
    expect(overflow.length).toBe(4 * Math.ceil((2 * 1024 * 1024) / 3))
    await expect(
      validateAsset({ ...asset(svg()), data_base64: overflow }),
    ).rejects.toThrow(/^Invalid asset$/)
  })
  test('requires license, attribution and alt text', async () => {
    for (const key of ['license', 'attribution', 'alt_text'] as const)
      await expect(
        validateAsset({ ...asset(svg()), [key]: '  ' }),
      ).rejects.toThrow(/^Invalid asset$/)
  })
})

describe('raster asset decoding', () => {
  test.each(['png', 'jpeg', 'webp'] as const)(
    'decodes and re-encodes a valid %s, stripping metadata and appended bytes',
    async (kind) => {
      const original = await sharp({
        create: { width: 12, height: 8, channels: 3, background: '#abcdef' },
      })
        .withMetadata({ exif: { IFD0: { Copyright: 'Synthetic metadata' } } })
        .toFormat(kind)
        .toBuffer()
      const polyglot = Buffer.concat([
        original,
        Buffer.from('<script>synthetic appended content</script>'),
      ])
      const result = await validateAsset(asset(polyglot, kind))
      expect(result).toMatchObject({
        width: 12,
        height: 8,
        mime: `image/${kind}`,
      })
      expect(result.data.includes(Buffer.from('<script>'))).toBe(false)
      const metadata = await sharp(result.data).metadata()
      expect(metadata.exif).toBeUndefined()
      expect(result.sha256).toBe(
        createHash('sha256').update(result.data).digest('hex'),
      )
    },
  )
  test('rejects a raster kind with wrong bytes, including SVG mislabeled as PNG', async () => {
    for (const data of [Buffer.from('not an image'), Buffer.from(svg())])
      await expect(validateAsset(asset(data, 'png'))).rejects.toThrow(
        /^Invalid asset$/,
      )
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer()
    await expect(validateAsset(asset(png, 'jpeg'))).rejects.toThrow(
      /^Invalid asset$/,
    )
  })
  test('rejects truncated PNG data', async () => {
    const png = await sharp({
      create: { width: 12, height: 8, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer()
    await expect(
      validateAsset(asset(png.subarray(0, 35), 'png')),
    ).rejects.toThrow(/^Invalid asset$/)
  })
  test('rejects dimensions over 8192 and input pixel count over 16 million', async () => {
    for (const [width, height] of [
      [8193, 1],
      [5000, 4000],
    ]) {
      const png = await sharp({
        create: {
          width: width!,
          height: height!,
          channels: 3,
          background: 'white',
        },
      })
        .png()
        .toBuffer()
      await expect(validateAsset(asset(png, 'png'))).rejects.toThrow(
        /^Invalid asset$/,
      )
    }
  })
})
