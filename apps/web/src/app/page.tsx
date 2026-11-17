import { Practice } from '../components/practice'
import { redirect } from 'next/navigation'
import { currentActor } from '../server/auth/actor'
import { readAuthConfig } from '../config'
export default async function HomePage() {
  const actor = await currentActor()
  if (!actor) redirect('/login')
  return (
    <Practice
      member={{ name: actor.name, role: actor.role }}
      canSignOut={readAuthConfig().AUTH_MODE !== 'dev'}
    />
  )
}
