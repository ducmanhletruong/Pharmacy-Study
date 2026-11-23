import { expect, test } from 'vitest'
import {
  assertTransition,
  canTransition,
  LifecycleError,
  questionStatuses,
  statusAfterReport,
  type TransitionEvidence,
} from './index'
const ready: TransitionEvidence = {
  sourceCount: 1,
  sourcesReady: true,
  assetsReady: true,
}
const expected = new Set([
  'draft:verified',
  'verified:approved',
  'approved:under_review',
  'approved:hidden',
  'approved:retired',
  'under_review:approved',
  'under_review:hidden',
  'hidden:approved',
  'hidden:retired',
])
for (const from of questionStatuses)
  for (const to of questionStatuses)
    test(`lifecycle ${from} → ${to}`, () => {
      const allowed = expected.has(`${from}:${to}`)
      expect(canTransition(from, to, ready)).toBe(allowed)
      if (allowed) expect(assertTransition(from, to, ready)).toBe(to)
      else
        expect(() => assertTransition(from, to, ready)).toThrow(LifecycleError)
    })
test('verification and publication require licensed approved sources and assets', () => {
  for (const [from, to] of [
    ['draft', 'verified'],
    ['verified', 'approved'],
    ['under_review', 'approved'],
    ['hidden', 'approved'],
  ] as const) {
    for (const evidence of [
      undefined,
      { ...ready, sourceCount: 0 },
      { ...ready, sourceCount: NaN },
      { ...ready, sourceCount: 1.5 },
      { ...ready, sourcesReady: false },
      { ...ready, assetsReady: false },
    ]) {
      expect(canTransition(from, to, evidence)).toBe(false)
      expect(() => assertTransition(from, to, evidence)).toThrow(/evidence/)
    }
  }
  expect(canTransition('approved', 'hidden')).toBe(true)
})
test('quarantine events never republish hidden or retired questions', () => {
  for (const current of questionStatuses)
    expect(statusAfterReport(current)).toBe(
      current === 'hidden' || current === 'retired' ? current : 'under_review',
    )
})
