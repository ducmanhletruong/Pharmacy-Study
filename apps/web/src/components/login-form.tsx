'use client'
import { useState, type FormEvent } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function LoginForm({
  google,
  guest,
  test,
  error,
}: {
  google: boolean
  guest: boolean
  test: boolean
  error: boolean
}) {
  const router = useRouter()
  const [message, setMessage] = useState(
    error
      ? 'Không thể đăng nhập. Vui lòng thử lại hoặc chọn chế độ ẩn danh.'
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
  async function guestLogin() {
    if (busy) return
    setBusy(true)
    setMessage('')
    try {
      const response = await signIn('guest', {
        redirect: false,
        callbackUrl: '/',
      })
      if (response?.ok && !response.error) {
        router.replace('/')
        router.refresh()
      } else setMessage('Chưa thể tạo phiên ẩn danh. Vui lòng thử lại.')
    } catch {
      setMessage('Không thể kết nối. Vui lòng thử lại.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="panel login-panel">
      <p className="eyebrow">PHARMACY STUDY</p>
      <h1>Vào học ngay.</h1>
      <p>
        Đăng nhập Google hoặc tiếp tục ẩn danh để bắt đầu học. Bài làm được lưu
        riêng cho bạn.
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
      {guest && (
        <>
          <button className="secondary" disabled={busy} onClick={guestLogin}>
            Tiếp tục ẩn danh
          </button>
          <p className="sample-note">
            Bài ẩn danh chỉ truy cập được trong phiên trình duyệt này, tối đa 8
            giờ. Đăng xuất hoặc xóa cookie sẽ mất quyền truy cập bài đã làm.
          </p>
        </>
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
      {!google && !test && !guest && (
        <p>Đăng nhập chưa sẵn sàng. Vui lòng liên hệ quản trị viên lớp học.</p>
      )}
    </div>
  )
}
