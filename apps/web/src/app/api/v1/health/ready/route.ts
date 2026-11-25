import { getPool } from '@pharmacy/db'

let pending: Promise<boolean> | undefined
const accountTables = [
  'public.auth_sessions',
  'public.attempts',
  'public.attempt_items',
  'public.written_papers',
  'public.written_attempts',
  'public.written_answers',
]

function databaseReady() {
  if (pending) return pending

  const query = Promise.resolve()
    .then(() =>
      getPool().query<{ ready: boolean }>(
        `SELECT
           (SELECT bool_and(pg_catalog.row_security_active(name::regclass))
              FROM unnest($1::text[]) AS relations(name))
           AND pg_catalog.has_table_privilege(
             current_user, 'public.released_revision_audiences', 'SELECT'
           ) AS ready`,
        [accountTables],
      ),
    )
    .then(
      (result) => result.rows[0]?.ready === true,
      () => false,
    )
  let timer: ReturnType<typeof setTimeout>
  const deadline = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), 1500)
  })
  pending = Promise.race([query, deadline])
  // A timed-out poll must not enqueue more work while the shared pool is blocked.
  void query.then(() => {
    clearTimeout(timer)
    pending = undefined
  })
  return pending
}

export async function GET() {
  const ready = await databaseReady()
  return Response.json(
    { status: ready ? 'ready' : 'unavailable' },
    { status: ready ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
