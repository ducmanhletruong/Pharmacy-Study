'use client'
import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function LoginForm({
  google,
  test,
  error,
}: {
  google: boolean
  test: boolean
  error: boolean
}) {
  const router = useRouter()
  const [message, setMessage] = useState(
    error
      ? 'Không thể đăng nhập. Tài khoản cần được mời và còn quyền truy cập.'
      : '',
  )
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false)
  async function login(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setMessage('')
    try {
      const response = await signIn('test', {
        email,
        password,
        redirect: false,
        callbackUrl: '/',
      })
      if (response?.ok && !response.error) {
        router.replace('/')
        router.refresh()
      } else setMessage('Không thể đăng nhập bằng tài khoản này.')
    } catch {
      setMessage('Không thể kết nối. Vui lòng thử lại.')
    } finally {
      setBusy(false)
      setPassword('')
    }
  }
  return (
    <div className="panel login-panel">
      <p className="eyebrow">PHARMACY STUDY · LỚP HỌC</p>
      <h1>Vào lớp học của bạn.</h1>
      <p>
        Chỉ dành cho các thành viên đã được mời. Bài làm của bạn được lưu riêng
        trong tài khoản.
      </p>
      {message && (
        <p role="alert" className="error">
          {message}
        </p>
      )}
      {google && (
        <button
          className="primary"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void signIn('google', { callbackUrl: '/' }).catch(() => {
              setBusy(false)
              setMessage('Không thể kết nối. Vui lòng thử lại.')
            })
          }}
        >
          Tiếp tục với Google
        </button>
      )}
      {test && (
        <form onSubmit={login}>
          <p className="sample-note">
            Đăng nhập kiểm thử — chỉ dùng tài khoản tổng hợp, không nhập mật
            khẩu Google.
          </p>
          <label>
            Email kiểm thử
            <input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              maxLength={254}
            />
          </label>
          <label>
            Mật khẩu kiểm thử
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              maxLength={200}
            />
          </label>
          <button className="primary" disabled={busy}>
            {busy ? 'Đang đăng nhập…' : 'Đăng nhập kiểm thử'}
          </button>
        </form>
      )}
      {!google && !test && (
        <p>Đăng nhập chưa sẵn sàng. Vui lòng liên hệ quản trị viên lớp học.</p>
      )}
    </div>
  )
}
