export type Point = readonly [number, number]

export function pointInPolygon(point: Point, polygon: readonly Point[]) {
  if (
    polygon.length < 3 ||
    ![point, ...polygon].every((pair) =>
      pair.every((value) => Number.isFinite(value) && value >= 0 && value <= 1),
    )
  )
    return false
  let inside = false,
    area = 0,
    boundary = false
  const [x, y] = point
  for (let i = 0; i < polygon.length; i++) {
    const [ax, ay] = polygon[i]!
    const [bx, by] = polygon[(i + 1) % polygon.length]!
    area += ax * by - bx * ay
    if (ax === bx && ay === by) continue
    const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax)
    if (
      Math.abs(cross) <= 1e-12 &&
      x >= Math.min(ax, bx) &&
      x <= Math.max(ax, bx) &&
      y >= Math.min(ay, by) &&
      y <= Math.max(ay, by)
    )
      boundary = true
    if (ay > y !== by > y && x < ((bx - ax) * (y - ay)) / (by - ay) + ax)
      inside = !inside
  }
  return Math.abs(area) > 1e-12 && (inside || boundary)
}
