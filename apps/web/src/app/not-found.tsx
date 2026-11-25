import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="workspace">
      <div className="panel login-panel">
        <p className="eyebrow">PHARMACY STUDY</p>
        <h1>Không tìm thấy trang.</h1>
        <p>Trang bạn mở không tồn tại hoặc đã được chuyển đi.</p>
        <Link className="primary" href="/">
          Về trang chủ
        </Link>
      </div>
    </main>
  )
}
