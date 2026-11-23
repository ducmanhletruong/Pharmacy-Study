import { expect, test } from 'vitest'
import { topics } from './practice'
const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
type Db = NonNullable<Parameters<typeof topics>[1]>
function database(rows: Record<string, unknown>[]) {
  let first = true
  return {
    query: (async () => {
      if (first) {
        first = false
        return { rows: [{ id: id(1) }] }
      }
      return { rows }
    }) as unknown as Db['query'],
  }
}
test('topic API refuses a hidden cyclic/orphaned component instead of returning an incomplete tree', async () => {
  for (const rows of [
    [
      { id: id(2), parent_id: id(3), code: 'a', title: 'a', sort_order: 0 },
      { id: id(3), parent_id: id(2), code: 'b', title: 'b', sort_order: 0 },
    ],
    [{ id: id(2), parent_id: id(9), code: 'a', title: 'a', sort_order: 0 }],
  ])
    await expect(topics('fixture', database(rows))).rejects.toMatchObject({
      code: 'invalid_topic_tree',
      status: 500,
    })
})
