import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import type { Audience } from '@pharmacy/core/audience'

export type AuditDetails = {
  position?: number
  is_correct?: boolean
  status?: string
  provider?: string
  reason?: string
  role?: string
  flagged?: boolean
  from_audience?: Audience
  to_audience?: Audience
  rights_basis_sha256?: string
}
export async function appendAudit(
  db: Pick<pg.PoolClient, 'query'>,
  event: {
    actorId: string | null
    action: string
    entityType: string
    entityId?: string
    details?: AuditDetails
    requestId?: string
  },
) {
  // Explicit whitelist: never persist arbitrary request bodies, emails, prompts,
  // cookies, provider tokens or credentials in an audit diff.
  const details = event.details ?? {}
  const safe: AuditDetails = {}
  if (Number.isSafeInteger(details.position) && details.position! > 0)
    safe.position = details.position
  if (typeof details.is_correct === 'boolean')
    safe.is_correct = details.is_correct
  if (typeof details.flagged === 'boolean') safe.flagged = details.flagged
  if (
    details.from_audience &&
    ['owner_only', 'class', 'public'].includes(details.from_audience)
  )
    safe.from_audience = details.from_audience
  if (
    details.to_audience &&
    ['owner_only', 'class', 'public'].includes(details.to_audience)
  )
    safe.to_audience = details.to_audience
  if (
    details.rights_basis_sha256 &&
    /^[a-f0-9]{64}$/.test(details.rights_basis_sha256)
  )
    safe.rights_basis_sha256 = details.rights_basis_sha256
  if (['google', 'test', 'guest'].includes(details.provider ?? ''))
    safe.provider = details.provider
  if (['admin', 'learner'].includes(details.role ?? ''))
    safe.role = details.role
  if (
    [
      'in_progress',
      'submitted',
      'expired',
      'draft',
      'verified',
      'approved',
      'under_review',
      'hidden',
      'retired',
      'pending',
      'rejected',
      'open',
      'accepted',
      'resolved',
      'imported',
      'already_imported',
    ].includes(details.status ?? '')
  )
    safe.status = details.status
  if (
    [
      'unauthenticated',
      'forbidden',
      'not_found',
      'rate_limited',
      'not_invited_or_unverified',
      'invalid_or_unverified_identity',
      'wrong_answer',
      'ambiguous',
      'typo',
      'bad_image',
      'other',
    ].includes(details.reason ?? '')
  )
    safe.reason = details.reason
  await db.query(
    'INSERT INTO audit_logs(actor_user_id,action,entity_type,entity_id,diff,request_id) VALUES($1,$2,$3,$4,$5::jsonb,$6)',
    [
      event.actorId,
      event.action,
      event.entityType,
      event.entityId ?? null,
      JSON.stringify(safe),
      event.requestId ?? randomUUID(),
    ],
  )
}
