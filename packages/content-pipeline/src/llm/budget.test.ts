import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { expect, test } from 'vitest'
import {
  batchCapMicros,
  estimateSmokeCost,
  monthlyCapMicros,
  reserveBudget,
} from './budget'

test('monthly budget counts unknown usage and releases only a confirmed unused reservation', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pharmacy-budget-fixture-'))
  const date = new Date('2026-11-23T00:00:00Z')
  await writeFile(
    join(dir, '2026-11-consuming.json'),
    JSON.stringify({
      reserved_micros: monthlyCapMicros - 450_000,
      actual_micros: null,
    }),
  )
  await expect(reserveBudget(dir, 500_001, 500_001, date)).rejects.toThrow(
    'Batch spending',
  )
  await expect(
    reserveBudget(dir, 460_000, batchCapMicros, date),
  ).rejects.toThrow('Monthly spending')
  const settle = await reserveBudget(dir, 420_000, batchCapMicros, date)
  await expect(
    reserveBudget(dir, 40_000, batchCapMicros, date),
  ).rejects.toThrow('Monthly spending')
  await settle(50_000)
  await expect(
    reserveBudget(dir, 40_000, batchCapMicros, date),
  ).resolves.toBeTypeOf('function')
  expect(estimateSmokeCost('Tests only', 'Synthetic only')).toBeLessThan(
    batchCapMicros,
  )
})
