import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng | Pharmacy Study',
}

export default function TermsPage() {
  return (
    <main className="workspace">
      <article className="panel login-panel">
        <h1>Điều khoản sử dụng</h1>
        <p>
          Pharmacy Study cung cấp câu hỏi và đề luyện tập cho năm môn Dược. Điểm
          trên website dùng để theo dõi tiến độ tự học.
        </p>
        <h2>Sử dụng tài khoản và học liệu</h2>
        <p>
          Hãy sử dụng tài khoản của mình hoặc chọn chế độ ẩn danh. Tôn trọng
          quyền truy cập của người học khác và quyền tác giả của học liệu.
        </p>
        <p>
          Xem <Link href="/privacy">chính sách quyền riêng tư</Link> để biết
          cách website xử lý dữ liệu đăng nhập và bài làm.
        </p>
        <Link href="/">Về trang chủ</Link>
      </article>
    </main>
  )
}
