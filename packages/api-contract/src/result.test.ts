import { expect, test } from 'vitest'
import { resultSchema } from './index'

const attemptId = '00000000-0000-4000-8000-000000000001'
const topicId = '00000000-0000-4000-8000-000000000002'
const validResult = () => ({
  attempt_id: attemptId,
  total: 3,
  correct: 1,
  unanswered: 1,
  score: 3.3,
  by_topic: [
    { topic_id: topicId, title: 'Synthetic topic', total: 3, correct: 1 },
  ],
})

test('accepts all 65 legal grading counts with one-decimal rational rounding', () => {
  for (let total = 1; total <= 10; total++) {
    for (let correct = 0; correct <= total; correct++) {
      const score = Math.floor((correct * 200 + total) / (total * 2)) / 10
      expect(
        resultSchema.safeParse({
          ...validResult(),
          total,
          correct,
          unanswered: total - correct,
          score,
          by_topic: [],
        }).success,
      ).toBe(true)
    }
  }
  expect(
    resultSchema.parse({
      ...validResult(),
      total: 0,
      correct: 0,
      unanswered: 0,
      score: 0,
      by_topic: [],
    }).score,
  ).toBe(0)
})

test('rejects negative, fractional and nonfinite counts and impossible totals', () => {
  for (const field of ['total', 'correct', 'unanswered'])
    for (const value of [-1, 0.5, NaN, Infinity])
      expect(
        resultSchema.safeParse({ ...validResult(), [field]: value }).success,
      ).toBe(false)
  for (const change of [
    { correct: 4 },
    { correct: 2, unanswered: 2 },
    { total: 0 },
  ])
    expect(
      resultSchema.safeParse({ ...validResult(), ...change }).success,
    ).toBe(false)
})

test('rejects scores inconsistent with the counts or rounding rule', () => {
  for (const score of [0, 3, 3.333333333, 3.4, 10, NaN, Infinity])
    expect(resultSchema.safeParse({ ...validResult(), score }).success).toBe(
      false,
    )
  expect(
    resultSchema.safeParse({
      ...validResult(),
      total: 0,
      correct: 0,
      unanswered: 0,
      score: 1,
    }).success,
  ).toBe(false)
})

test('validates each topic internally without forbidding overlapping topics', () => {
  const topic = validResult().by_topic[0]!
  for (const change of [
    { total: -1 },
    { correct: -1 },
    { correct: 4 },
    { total: 1.5 },
  ])
    expect(
      resultSchema.safeParse({
        ...validResult(),
        by_topic: [{ ...topic, ...change }],
      }).success,
    ).toBe(false)
  expect(
    resultSchema.parse({
      ...validResult(),
      by_topic: [
        topic,
        { ...topic, topic_id: '00000000-0000-4000-8000-000000000003' },
      ],
    }).by_topic,
  ).toHaveLength(2)
})

test('topic subsets cannot exceed attempt counts or repeat a topic identity', () => {
  const result = validResult(),
    topic = result.by_topic[0]!
  for (const change of [{ total: 4 }, { correct: 2 }])
    expect(
      resultSchema.safeParse({ ...result, by_topic: [{ ...topic, ...change }] })
        .success,
    ).toBe(false)
  expect(
    resultSchema.safeParse({ ...result, by_topic: [topic, { ...topic }] })
      .success,
  ).toBe(false)
  const letterId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  expect(
    resultSchema.safeParse({
      ...result,
      by_topic: [
        { ...topic, topic_id: letterId },
        { ...topic, topic_id: letterId.toUpperCase() },
      ],
    }).success,
  ).toBe(false)
})
