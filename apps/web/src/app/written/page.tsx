import { redirect } from 'next/navigation'
import { currentActor } from '../../server/auth/actor'
import { WrittenWorkbench } from '../../components/written-workbench'
export default async function WrittenPage() {
  if (!(await currentActor())) redirect('/login?next=/written')
  return <WrittenWorkbench />
}
