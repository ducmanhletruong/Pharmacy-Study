import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { SaxesParser, type SaxesTagNS } from 'saxes'

const MAX_BYTES = 2 * 1024 * 1024
const MAX_BASE64_LENGTH = 4 * Math.ceil(MAX_BYTES / 3)
const MAX_DIMENSION = 8192
const MAX_PIXELS = 16_000_000
const SVG_NS = 'http://www.w3.org/2000/svg'
const XMLNS_NS = 'http://www.w3.org/2000/xmlns/'
const NUMBER_SOURCE = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?'
const NUMBER = new RegExp(`^${NUMBER_SOURCE}$`)
const NUMBER_TOKEN = new RegExp(NUMBER_SOURCE, 'g')

export type AssetInput = {
  kind: 'svg' | 'png' | 'jpeg' | 'webp'
  data_base64: string
  license: string
  attribution: string
  alt_text: string
  source_ref?: string
}

function invalid(): never {
  throw new Error('Invalid asset')
}
function dimension(width: number, height: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0 ||
    width > MAX_DIMENSION ||
    height > MAX_DIMENSION ||
    width * height > MAX_PIXELS
  )
    invalid()
}
function metadataText(value: unknown, maxLength: number) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(value)
  )
    invalid()
}
function scalar(value: string, min = -1_000_000, max = 1_000_000) {
  if (!NUMBER.test(value.trim())) invalid()
  const number = Number(value)
  if (!Number.isFinite(number) || number < min || number > max) invalid()
  return number
}
function numberList(value: string, minLength: number, maxLength: number) {
  const trimmed = value.trim()
  const list = trimmed.split(/[\s,]+/)
  if (
    !trimmed ||
    list.length < minLength ||
    list.length > maxLength ||
    /^,|,$|,\s*,/.test(trimmed)
  )
    invalid()
  return list.map((part) => scalar(part))
}
function paint(value: string) {
  if (
    /^(?:none|currentColor|transparent|[a-zA-Z]{1,32}|#[\da-fA-F]{3}|#[\da-fA-F]{4}|#[\da-fA-F]{6}|#[\da-fA-F]{8})$/.test(
      value,
    )
  )
    return
  const rgb = /^(rgb|rgba)\(([^()]*)\)$/.exec(value)
  if (!rgb) invalid()
  const parts = rgb[2]!.split(',').map((part) => part.trim())
  if (parts.length !== (rgb[1] === 'rgb' ? 3 : 4)) invalid()
  for (const part of parts.slice(0, 3)) scalar(part, 0, 255)
  if (parts[3] !== undefined) scalar(parts[3], 0, 1)
}
function transform(value: string) {
  const functions = /(matrix|translate|scale|rotate|skewX|skewY)\(([^()]*)\)/g
  const arities: Record<string, number[]> = {
    matrix: [6],
    translate: [1, 2],
    scale: [1, 2],
    rotate: [1, 3],
    skewX: [1],
    skewY: [1],
  }
  let end = 0,
    count = 0
  for (const match of value.matchAll(functions)) {
    if (value.slice(end, match.index).trim() || ++count > 64) invalid()
    const parts = numberList(match[2]!, 1, 6)
    if (!arities[match[1]!]!.includes(parts.length)) invalid()
    end = match.index + match[0].length
  }
  if (!count || value.slice(end).trim()) invalid()
}
function path(value: string) {
  if (
    value.length > 200_000 ||
    !/^\s*[Mm]/.test(value) ||
    /[^MmZzLlHhVvCcSsQqTtAaEe\d\s.,+\-]/.test(value)
  )
    invalid()
  const commands = value.match(/[MmZzLlHhVvCcSsQqTtAa]/g) ?? []
  if (commands.length > 10_000) invalid()
  const numbersOnly = value.replace(/[MmZzLlHhVvCcSsQqTtAa]/g, ' ')
  for (const token of numbersOnly.matchAll(NUMBER_TOKEN)) scalar(token[0])
  if (numbersOnly.replace(NUMBER_TOKEN, '').replace(/[\s,]/g, '')) invalid()
}

const geometry: Record<string, string[]> = {
  svg: ['width', 'height', 'viewBox', 'preserveAspectRatio'],
  g: [],
  defs: [],
  path: ['d'],
  rect: ['x', 'y', 'width', 'height', 'rx', 'ry'],
  line: ['x1', 'y1', 'x2', 'y2'],
  polyline: ['points'],
  polygon: ['points'],
  circle: ['cx', 'cy', 'r'],
  ellipse: ['cx', 'cy', 'rx', 'ry'],
}
const common = new Set([
  'fill',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'fill-rule',
  'transform',
])
function svgAttribute(name: string, value: string) {
  if (value.length > 200_000) invalid()
  if (name === 'fill' || name === 'stroke') return paint(value)
  if (name === 'transform') return transform(value)
  if (name === 'd') return path(value)
  if (name === 'points') {
    const points = numberList(value, 4, 100_000)
    if (points.length % 2) invalid()
    return
  }
  if (name === 'viewBox') {
    const box = numberList(value, 4, 4)
    if (box[2]! <= 0 || box[3]! <= 0) invalid()
    return
  }
  if (name === 'preserveAspectRatio') {
    if (
      !/^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max)(?: (?:meet|slice))?)$/.test(
        value,
      )
    )
      invalid()
    return
  }
  const enums: Record<string, string[]> = {
    'stroke-linecap': ['butt', 'round', 'square'],
    'stroke-linejoin': ['miter', 'round', 'bevel'],
    'fill-rule': ['nonzero', 'evenodd'],
  }
  if (enums[name]) {
    if (!enums[name].includes(value)) invalid()
    return
  }
  if (name === 'stroke-dasharray') {
    if (value !== 'none' && numberList(value, 1, 256).some((part) => part < 0))
      invalid()
    return
  }
  if (['opacity', 'fill-opacity', 'stroke-opacity'].includes(name)) {
    scalar(value, 0, 1)
    return
  }
  if (['width', 'height'].includes(name)) {
    scalar(value.replace(/px$/, ''), 0)
    return
  }
  scalar(
    value,
    ['r', 'rx', 'ry', 'stroke-width', 'stroke-miterlimit'].includes(name)
      ? 0
      : -1_000_000,
  )
}
function validateSvg(data: Buffer) {
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(data)
  const parser = new SaxesParser({ xmlns: true })
  let root: SaxesTagNS | undefined,
    depth = 0,
    nodes = 0
  parser.on('error', invalid)
  parser.on('doctype', invalid)
  parser.on('processinginstruction', invalid)
  parser.on('xmldecl', invalid)
  parser.on('cdata', invalid)
  parser.on('comment', invalid)
  parser.on('text', (value) => {
    if (value.trim()) invalid()
  })
  parser.on('opentag', (tag) => {
    if (
      ++depth > 64 ||
      ++nodes > 10_000 ||
      tag.uri !== SVG_NS ||
      tag.prefix ||
      !Object.hasOwn(geometry, tag.local) ||
      (depth === 1 && (root || tag.local !== 'svg')) ||
      (depth > 1 && tag.local === 'svg') ||
      Object.keys(tag.attributes).length > 32
    )
      invalid()
    if (depth === 1) root = tag
    for (const attribute of Object.values(tag.attributes)) {
      if (attribute.uri === XMLNS_NS) {
        if (
          depth !== 1 ||
          attribute.name !== 'xmlns' ||
          attribute.value !== SVG_NS
        )
          invalid()
        continue
      }
      if (
        attribute.prefix ||
        attribute.uri ||
        (!common.has(attribute.name) &&
          !geometry[tag.local]!.includes(attribute.name))
      )
        invalid()
      svgAttribute(attribute.name, attribute.value)
    }
  })
  parser.on('closetag', () => {
    depth--
  })
  parser.write(xml).close()
  if (!root || depth !== 0 || root.attributes.xmlns?.value !== SVG_NS) invalid()
  const widthValue = root.attributes.width?.value,
    heightValue = root.attributes.height?.value,
    box = root.attributes.viewBox?.value
  let width: number, height: number
  if (widthValue !== undefined && heightValue !== undefined) {
    width = scalar(widthValue.replace(/px$/, ''), 0)
    height = scalar(heightValue.replace(/px$/, ''), 0)
  } else if (
    widthValue === undefined &&
    heightValue === undefined &&
    box !== undefined
  ) {
    const values = numberList(box, 4, 4)
    width = values[2]!
    height = values[3]!
  } else invalid()
  width = Math.ceil(width)
  height = Math.ceil(height)
  dimension(width, height)
  return { data, mime: 'image/svg+xml', width, height }
}
function rasterSignature(kind: AssetInput['kind'], data: Buffer) {
  if (kind === 'png')
    return data
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (kind === 'jpeg')
    return (
      data.length >= 4 && data[0] === 255 && data[1] === 216 && data[2] === 255
    )
  return (
    data.length >= 12 &&
    data.toString('ascii', 0, 4) === 'RIFF' &&
    data.toString('ascii', 8, 12) === 'WEBP'
  )
}

export async function validateAsset(input: AssetInput): Promise<{
  data: Buffer
  mime: string
  sha256: string
  width: number
  height: number
}> {
  try {
    metadataText(input.license, 4096)
    metadataText(input.attribution, 4096)
    metadataText(input.alt_text, 2000)
    if (input.source_ref !== undefined) metadataText(input.source_ref, 256)
    if (
      !['svg', 'png', 'jpeg', 'webp'].includes(input.kind) ||
      typeof input.data_base64 !== 'string' ||
      !input.data_base64.length ||
      input.data_base64.length > MAX_BASE64_LENGTH ||
      input.data_base64.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(input.data_base64)
    )
      invalid()
    const decoded = Buffer.from(input.data_base64, 'base64')
    if (
      decoded.length > MAX_BYTES ||
      decoded.toString('base64') !== input.data_base64
    )
      invalid()
    if (input.kind === 'svg') {
      const validated = validateSvg(decoded)
      return {
        ...validated,
        sha256: createHash('sha256').update(validated.data).digest('hex'),
      }
    }
    if (!rasterSignature(input.kind, decoded)) invalid()
    const image = sharp(decoded, {
      limitInputPixels: MAX_PIXELS,
      failOn: 'warning',
      sequentialRead: true,
    })
    const metadata = await image.metadata()
    if (
      metadata.format !== input.kind ||
      (metadata.pages !== undefined && metadata.pages !== 1)
    )
      invalid()
    dimension(metadata.width, metadata.height)
    const normalized = await image
      .rotate()
      .toColourspace('srgb')
      .toFormat(input.kind)
      .toBuffer({ resolveWithObject: true })
    dimension(normalized.info.width, normalized.info.height)
    if (normalized.data.length > MAX_BYTES) invalid()
    return {
      data: normalized.data,
      mime: `image/${input.kind}`,
      sha256: createHash('sha256').update(normalized.data).digest('hex'),
      width: normalized.info.width,
      height: normalized.info.height,
    }
  } catch {
    return invalid()
  }
}
