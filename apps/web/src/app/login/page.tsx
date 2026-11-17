import { redirect } from 'next/navigation'
import { currentActor } from '../../server/auth/actor'
import { readAuthConfig } from '../../config'
import { LoginForm } from '../../components/login-form'
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  if (await currentActor()) redirect('/')
  const config = readAuthConfig()
  return (
    <main className="workspace">
      <LoginForm
        google={config.AUTH_MODE === 'oidc'}
        test={config.AUTH_MODE === 'test' && config.NODE_ENV !== 'production'}
        error={Boolean((await searchParams).error)}
      />
    </main>
  )
}
