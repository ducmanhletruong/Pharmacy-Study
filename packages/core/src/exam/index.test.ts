import { expect, test } from 'vitest'
import { assembleExam, InsufficientQuestions } from './index'
const candidates = Array.from({ length: 30 }, (_, i) => ({
  id: String(i),
  revision_id: 'r' + i,
  topic_ids: i < 10 ? ['a', 'b'] : ['a'],
  difficulty: (i % 3) + 1,
}))
test('seeded assembly is repeatable, respects counts/difficulty and has no duplicates', () => {
  const slots = [
    { topic_id: 'a', difficulty: 1, count: 5 },
    { topic_id: 'b', count: 5 },
  ]
  const a = assembleExam(candidates, slots, 'fixed')
  expect(assembleExam([...candidates].reverse(), slots, 'fixed')).toEqual(a)
  expect(new Set(a.map((q) => q.id)).size).toBe(10)
  expect(a.slice(0, 5).every((q) => q.difficulty === 1)).toBe(true)
  expect(a.slice(5).every((q) => q.topic_ids.includes('b'))).toBe(true)
  expect(assembleExam(candidates, slots, 'different')).not.toEqual(a)
})
test('overlapping groups backtrack rather than starving a more constrained group', () => {
  expect(
    assembleExam(
      [
        { id: 'x', revision_id: 'x', difficulty: 1, topic_ids: ['a', 'b'] },
        { id: 'y', revision_id: 'y', difficulty: 1, topic_ids: ['a'] },
      ],
      [
        { topic_id: 'a', count: 1 },
        { topic_id: 'b', count: 1 },
      ],
      'seed',
    ).map((c) => c.id),
  ).toEqual(['y', 'x'])
})
test('overlap cannot reuse a question or invent capacity', () => {
  expect(() => assembleExam(candidates, [{ count: 31 }], 'seed')).toThrow(
    InsufficientQuestions,
  )
  expect(() =>
    assembleExam([candidates[0]!, candidates[0]!], [{ count: 2 }], 'seed'),
  ).toThrow(InsufficientQuestions)
})
