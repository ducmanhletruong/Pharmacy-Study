export type Role = 'admin' | 'learner'
export type Actor = { id: string; role: Role; status: 'active' | 'disabled' }
export const actions = [
  'practice:use',
  'attempt:create',
  'attempt:read',
  'attempt:answer',
  'attempt:submit',
  'admin:access',
  'content:manage',
  'audit:read',
] as const
export type Action = (typeof actions)[number]

export function authorize(
  actor: Actor | null,
  action: Action,
  resource?: { user_id: string },
) {
  if (!actor?.id || actor.status !== 'active') return false
  if (action === 'practice:use' || action === 'attempt:create')
    return actor.role === 'admin' || actor.role === 'learner'
  if (['attempt:read', 'attempt:answer', 'attempt:submit'].includes(action))
    return (
      resource?.user_id === actor.id &&
      (actor.role === 'admin' || actor.role === 'learner')
    )
  if (['admin:access', 'content:manage', 'audit:read'].includes(action))
    return actor.role === 'admin'
  return false
}
