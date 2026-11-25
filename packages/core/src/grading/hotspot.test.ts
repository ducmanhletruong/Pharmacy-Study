import { expect, test } from 'vitest'
import { pointInPolygon, type Point } from './hotspot'

test('normalized hotspot treats edges as inside and excludes a concave cutout', () => {
  const polygon: Point[] = [
    [0.1, 0.1],
    [0.9, 0.1],
    [0.9, 0.9],
    [0.5, 0.4],
    [0.1, 0.9],
  ]
  expect(pointInPolygon([0.5, 0.2], polygon)).toBe(true)
  expect(pointInPolygon([0.5, 0.75], polygon)).toBe(false)
  expect(pointInPolygon([0.5, 0.4], polygon)).toBe(true)
  expect(pointInPolygon([0.1, 0.45], polygon)).toBe(true)
  expect(pointInPolygon([-1, 0.5], polygon)).toBe(false)
  expect(
    pointInPolygon(
      [0.3, 0.3],
      [
        [0.1, 0.1],
        [0.3, 0.3],
        [0.5, 0.5],
      ],
    ),
  ).toBe(false)
})
