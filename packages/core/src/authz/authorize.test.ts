import { expect, test } from 'vitest'
import { actions, authorize, type Actor, type Action } from './index'

for (const role of ['admin', 'learner'] as const) {
  for (const status of ['active', 'disabled'] as const) {
    for (const action of actions) {
      for (const ownership of ['own', 'other', 'missing'] as const) {
        test(`${role}/${status}/${action}/${ownership}`, () => {
          const actor: Actor = { id: 'actor-a', role, status }
          const resource =
            ownership === 'missing'
              ? undefined
              : { user_id: ownership === 'own' ? 'actor-a' : 'actor-b' }
          const ownAction =
            action.startsWith('attempt:') && action !== 'attempt:create'
          const adminAction = [
            'admin:access',
            'content:manage',
            'audit:read',
          ].includes(action)
          const expected =
            status === 'active' &&
            (adminAction
              ? role === 'admin'
              : ownAction
                ? ownership === 'own'
                : true)
          expect(authorize(actor, action, resource)).toBe(expected)
        })
      }
    }
  }
}
test('no identity, unknown action or invalid role grants nothing', () => {
  for (const action of actions)
    expect(authorize(null, action, { user_id: 'actor-a' })).toBe(false)
  expect(
    authorize(
      { id: 'a', role: 'admin', status: 'active' },
      'unknown' as Action,
    ),
  ).toBe(false)
  expect(
    authorize({ id: '', role: 'admin', status: 'active' }, 'admin:access'),
  ).toBe(false)
  expect(
    authorize(
      { id: 'a', role: 'unexpected' as Actor['role'], status: 'active' },
      'practice:use',
    ),
  ).toBe(false)
})
