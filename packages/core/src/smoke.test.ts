import { describe, expect, it } from 'vitest'
import { GET } from '../../../apps/web/src/app/api/v1/health/route'

describe('health contract', () => {
  it('returns a healthy JSON response without database or AI dependencies', async () => {
    const response = GET()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ status: 'ok' })
  })
})
