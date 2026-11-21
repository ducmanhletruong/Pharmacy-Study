import { redirect } from 'next/navigation'
import { currentActor } from '../../server/auth/actor'
import { LearningWorkbench } from '../../components/learning-workbench'
export default async function StudyPage() {
  if (!(await currentActor())) redirect('/login')
  return <LearningWorkbench />
}
