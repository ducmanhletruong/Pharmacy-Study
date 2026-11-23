export const questionStatuses = [
  'draft',
  'verified',
  'approved',
  'under_review',
  'hidden',
  'retired',
] as const
export type QuestionStatus = (typeof questionStatuses)[number]
export type TransitionEvidence = {
  sourceCount: number
  /** Every linked source has been approved and has a recorded license. */
  sourcesReady: boolean
  /** Every linked asset is licensed and its linked source, if any, is approved. */
  assetsReady: boolean
}
const transitions: Record<QuestionStatus, readonly QuestionStatus[]> = {
  draft: ['verified'],
  verified: ['approved'],
  approved: ['under_review', 'hidden', 'retired'],
  under_review: ['approved', 'hidden'],
  hidden: ['approved', 'retired'],
  retired: [],
}
export class LifecycleError extends Error {
  readonly code = 'invalid_state_transition'
}
export function canTransition(
  current: QuestionStatus,
  next: QuestionStatus,
  evidence?: TransitionEvidence,
) {
  if (!transitions[current]?.includes(next)) return false
  if (next !== 'verified' && next !== 'approved') return true
  return Boolean(
    evidence &&
    Number.isSafeInteger(evidence.sourceCount) &&
    evidence.sourceCount >= 1 &&
    evidence.sourcesReady === true &&
    evidence.assetsReady === true,
  )
}
export function assertTransition(
  current: QuestionStatus,
  next: QuestionStatus,
  evidence?: TransitionEvidence,
): QuestionStatus {
  if (!canTransition(current, next, evidence))
    throw new LifecycleError(
      'Transition is not allowed or release evidence is incomplete',
    )
  return next
}
/** A learner report or a rejected source quarantines content; it cannot republish it. */
export function statusAfterReport(current: QuestionStatus): QuestionStatus {
  return current === 'hidden' || current === 'retired'
    ? current
    : 'under_review'
}
