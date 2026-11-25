import { redirect } from 'next/navigation'
import Link from 'next/link'
import { currentActor } from '../../server/auth/actor'
import { readAuthConfig } from '../../config'
import { LoginForm } from '../../components/login-form'
const destinations = ['/study', '/written']
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const params = await searchParams
  const next = destinations.includes(params.next ?? '') ? params.next! : '/'
  if (await currentActor()) redirect(next)
  const config = readAuthConfig()
  return (
    <main className="workspace">
      <LoginForm
        google={config.AUTH_MODE === 'oidc'}
        guest={['oidc', 'test', 'guest'].includes(config.AUTH_MODE)}
        test={config.AUTH_MODE === 'test' && config.NODE_ENV !== 'production'}
        error={Boolean(params.error)}
        next={next}
      />
      <footer className="site-footer">
        <span>Ôn tập và luyện đề cho 5 môn Dược.</span>
        <Link href="/privacy">Chính sách quyền riêng tư</Link>
        <Link href="/terms">Điều khoản sử dụng</Link>
      </footer>
    </main>
  )
}
