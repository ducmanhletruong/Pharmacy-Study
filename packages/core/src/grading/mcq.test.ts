import { expect, test } from 'vitest'
import { gradeMcq, validateChoices, type Choice, type Label } from './mcq'
const choices: Choice[] = ['A', 'B', 'C', 'D'].map((label, index) => ({
  label: label as Label,
  text: `Choice ${index}`,
  is_correct: index === 2,
}))
test('grades by label, not choice order', () => {
  expect(gradeMcq([...choices].reverse(), 'C')).toEqual({
    is_correct: true,
    correct_answer: 'C',
  })
  expect(gradeMcq(choices, 'A')).toEqual({
    is_correct: false,
    correct_answer: 'C',
  })
})
test('rejects ambiguous banks before grading', () => {
  for (const invalid of [
    choices.slice(1),
    choices.map((c) => ({ ...c, is_correct: false })),
    choices.map((c) => ({ ...c, is_correct: true })),
    choices.map((c) => ({ ...c, text: 'same' })),
    choices.map((c) => ({ ...c, label: 'A' as const })),
  ]) {
    expect(() => validateChoices(invalid)).toThrow()
  }
})
