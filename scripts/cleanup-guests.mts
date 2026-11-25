import { pathToFileURL } from 'node:url'
import {
  closeMaintenance,
  getMaintenancePool,
} from '../packages/db/src/maintenance'

// Protect active sessions, unknown activity and any account with a non-guest identity.
const eligible = `
  u.role='learner' AND u.guest_last_active_at < $1::timestamptz
  AND EXISTS(SELECT 1 FROM auth_identities g WHERE g.user_id=u.id AND g.provider='guest')
  AND NOT EXISTS(SELECT 1 FROM auth_identities g WHERE g.user_id=u.id AND g.provider<>'guest')
  AND NOT EXISTS(SELECT 1 FROM auth_sessions s WHERE s.user_id=u.id AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp())
  AND NOT EXISTS(SELECT 1 FROM question_revisions r WHERE r.created_by=u.id)
  AND NOT EXISTS(SELECT 1 FROM imports i WHERE i.uploaded_by=u.id)
  AND NOT EXISTS(SELECT 1 FROM exam_blueprints b WHERE b.created_by=u.id)
  AND NOT EXISTS(SELECT 1 FROM question_reports r WHERE r.resolved_by=u.id)
`

export async function cleanupGuests(days: number, apply: boolean) {
  if (!Number.isSafeInteger(days) || days < 1 || days > 3650)
    throw new Error('GUEST_RETENTION_DAYS must be an integer from 1 to 3650')
  const client = await getMaintenancePool().connect()
  try {
    await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY')
    await client.query("SET LOCAL lock_timeout='5s'")
    const { cutoff } = (
      await client.query<{ cutoff: Date }>(
        "SELECT statement_timestamp()-$1::int*interval '24 hours' AS cutoff",
        [days],
      )
    ).rows[0]!
    if (!apply) {
      const { count } = (
        await client.query<{ count: number }>(
          `SELECT count(*)::int AS count FROM users u WHERE ${eligible}`,
          [cutoff],
        )
      ).rows[0]!
      await client.query('COMMIT')
      return { mode: 'dry-run', eligible: count, removed: 0 }
    }
    const locked = await client.query<{ id: string }>(
      `SELECT u.id FROM users u WHERE ${eligible} ORDER BY u.guest_last_active_at,u.id LIMIT 250 FOR UPDATE SKIP LOCKED`,
      [cutoff],
    )
    const checked = await client.query<{ id: string }>(
      `SELECT u.id FROM users u WHERE ${eligible} AND u.id=ANY($2::uuid[])`,
      [cutoff, locked.rows.map((row) => row.id)],
    )
    const ids = checked.rows.map((row) => row.id)
    const args = [ids]
    await client.query(
      'DELETE FROM written_answers WHERE attempt_id IN (SELECT id FROM written_attempts WHERE user_id=ANY($1::uuid[]))',
      args,
    )
    await client.query(
      'DELETE FROM written_attempts WHERE user_id=ANY($1::uuid[])',
      args,
    )
    await client.query(
      'DELETE FROM written_papers WHERE user_id=ANY($1::uuid[])',
      args,
    )
    await client.query(
      'DELETE FROM attempt_items WHERE attempt_id IN (SELECT id FROM attempts WHERE user_id=ANY($1::uuid[]))',
      args,
    )
    await client.query(
      'DELETE FROM attempts WHERE user_id=ANY($1::uuid[])',
      args,
    )
    // Preserve the bank's quarantine/review history without attributing it to a guest.
    await client.query(
      "UPDATE question_reports SET reporter_id=NULL,note='' WHERE reporter_id=ANY($1::uuid[])",
      args,
    )
    await client.query(
      'DELETE FROM auth_sessions WHERE user_id=ANY($1::uuid[])',
      args,
    )
    await client.query(
      'DELETE FROM auth_identities WHERE user_id=ANY($1::uuid[])',
      args,
    )
    await client.query(
      "DELETE FROM request_limits WHERE split_part(bucket,':',1)='api' AND split_part(bucket,':',2)=ANY($1::text[])",
      args,
    )
    const removed = await client.query(
      'DELETE FROM users WHERE id=ANY($1::uuid[])',
      args,
    )
    await client.query('COMMIT')
    return { mode: 'apply', eligible: ids.length, removed: removed.rowCount }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const args = process.argv.slice(2)
    if (
      args.length > 1 ||
      (args.length === 1 && !['--dry-run', '--apply'].includes(args[0]))
    )
      throw new Error('Usage: cleanup-guests.mts [--dry-run|--apply]')
    if (!process.env.MIGRATION_DATABASE_URL)
      throw new Error('An explicit maintenance database connection is required')
    const result = await cleanupGuests(
      Number(process.env.GUEST_RETENTION_DAYS ?? 90),
      args[0] === '--apply',
    )
    console.log(JSON.stringify(result))
  } catch {
    console.error(
      'Guest retention job failed. Check the database, rights and arguments.',
    )
    process.exitCode = 1
  } finally {
    await closeMaintenance()
  }
}
