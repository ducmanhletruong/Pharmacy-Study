import { createHash } from 'node:crypto'
import { getPool } from './client'

export async function takeRateLimit(key: string, limit: number) {
  const bucket = createHash('sha256').update(key).digest('hex')
  const result = await getPool().query<{ hits: number; retry_after: number }>(
    `INSERT INTO request_limits(bucket,window_started,hits) VALUES($1,statement_timestamp(),1)
 ON CONFLICT(bucket) DO UPDATE SET
 hits=CASE WHEN request_limits.window_started<=statement_timestamp()-interval '60 seconds' THEN 1 ELSE request_limits.hits+1 END,
 window_started=CASE WHEN request_limits.window_started<=statement_timestamp()-interval '60 seconds' THEN statement_timestamp() ELSE request_limits.window_started END
 RETURNING hits,GREATEST(1,ceil(extract(epoch FROM (window_started+interval '60 seconds'-statement_timestamp()))))::int retry_after`,
    [bucket],
  )
  const row = result.rows[0]!
  return { allowed: row.hits <= limit, retryAfter: row.retry_after }
}
