import type { Rounding } from '../template'

export function format(
  value: number,
  decimals: number,
  rounding: Rounding = 'legacy',
) {
  if (!Number.isFinite(value)) throw Error('Nonfinite answer')
  const options = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: false,
    roundingMode: 'halfEven' as const,
  }
  const rounded =
    rounding === 'half-even'
      ? new Intl.NumberFormat('en-US', options).format(value)
      : value.toFixed(decimals)
  return Object.is(Number(rounded), -0) ? rounded.slice(1) : rounded
}
export function distractors(
  answer: number,
  decimals: number,
  candidates: number[],
  rounding?: Rounding,
) {
  const correct = format(answer, decimals, rounding),
    seen = new Set([correct]),
    values: string[] = []
  for (const v of [
    ...candidates,
    ...Array.from({ length: 20 }, (_, i) => answer + (i + 1) * 10 ** -decimals),
  ]) {
    if (!Number.isFinite(v)) continue
    const text = format(v, decimals, rounding)
    if (!seen.has(text)) {
      seen.add(text)
      values.push(text)
    }
    if (values.length === 3) return values
  }
  throw Error('Cannot create distinct distractors')
}
