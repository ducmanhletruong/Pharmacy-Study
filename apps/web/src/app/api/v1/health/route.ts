export function GET() {
  const releaseId = process.env.NEXT_PUBLIC_APP_RELEASE_ID
  if (releaseId && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(releaseId))
    return Response.json({ status: 'ok', release_id: releaseId })
  return Response.json({ status: 'ok' })
}
