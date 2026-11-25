export const families = [
  'strong-acid',
  'weak-acid-concentration',
  'weak-acid-mass',
  'weak-acid-titration',
  'redox-titration',
  'redox-equivalence-volume',
  'edta-equivalence',
  'edta-metal-side-reactions',
  'edta-active-ligand',
  'diprotic-salt-solubility',
  'diprotic-2-to-1-solubility',
  'diprotic-2-to-1-solubility-ratio',
  'buffer',
  'sample-sd',
  'surplus-rate',
  'surplus-mass',
] as const
export type Family = (typeof families)[number]
export type Rounding = 'legacy' | 'half-even'
export type Template = {
  family: Family
  decimals: number
  tolerance: number
  rounding?: Rounding
}
export function validateTemplate(value: Template) {
  if (
    !families.includes(value.family) ||
    !Number.isInteger(value.decimals) ||
    value.decimals < 0 ||
    value.decimals > 6 ||
    (value.rounding !== undefined &&
      value.rounding !== 'legacy' &&
      value.rounding !== 'half-even') ||
    !Number.isFinite(value.tolerance) ||
    value.tolerance < 0 ||
    value.tolerance > 1e-5
  )
    throw Error('Invalid calculation template')
  return value
}
export const maxSeedLength = 200
export function random(seed: string, suffix = '') {
  if (!seed.length || seed.length > maxSeedLength) throw Error('Invalid seed')
  let state = 2166136261
  for (const char of seed + suffix)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export function sample(family: Family, seed: string) {
  const next = random(seed),
    integer = (lo: number, hi: number) =>
      lo + Math.floor(next() * (hi - lo + 1))
  switch (family) {
    case 'strong-acid':
      return [integer(1, 9) * 10 ** -integer(2, 4)]
    case 'weak-acid-concentration':
      return [integer(250, 360) / 100, integer(350, 430) / 100]
    case 'weak-acid-mass':
      return [
        integer(250, 360) / 100,
        integer(350, 430) / 100,
        integer(1, 10) / 10,
        integer(60, 180),
      ]
    case 'weak-acid-titration':
      return [integer(340, 460) / 100, integer(5, 20) / 100, integer(1, 2) / 2]
    case 'redox-titration':
      return [integer(140, 180) / 100, integer(65, 85) / 100, integer(1, 2)]
    case 'redox-equivalence-volume':
      return [
        integer(10, 50),
        integer(5, 15) / 100,
        integer(5, 25) / 100,
        integer(1, 2),
      ]
    case 'edta-equivalence':
      return [
        integer(95, 110) / 10,
        integer(10, 35) / 10,
        integer(30, 150) / 10000,
      ]
    case 'edta-metal-side-reactions':
      return [
        integer(95, 105) / 10,
        integer(20, 35) / 10,
        integer(30, 150) / 10000,
        integer(2, 12),
      ]
    case 'edta-active-ligand':
      return [
        integer(130, 170) / 10,
        integer(40, 60) / 10,
        integer(30, 150) / 10000,
        integer(3, 40),
      ]
    case 'diprotic-salt-solubility':
    case 'diprotic-2-to-1-solubility':
      return [
        next() < 0.5 ? 2 : 7,
        integer(10, 20) / 10,
        integer(35, 47) / 10,
        (family === 'diprotic-salt-solubility'
          ? integer(70, 90)
          : integer(95, 125)) / 10,
      ]
    case 'diprotic-2-to-1-solubility-ratio':
      return [integer(10, 20) / 10, integer(35, 47) / 10]
    case 'buffer':
      return [integer(350, 650) / 100, integer(1, 100), integer(1, 100)]
    case 'sample-sd':
      return Array.from({ length: integer(3, 12) }, () => integer(1, 1000) / 10)
    case 'surplus-rate':
      return [integer(1, 1000), integer(1, 1000)]
    case 'surplus-mass':
      return [integer(1, 500), integer(1, 1000)]
  }
}
