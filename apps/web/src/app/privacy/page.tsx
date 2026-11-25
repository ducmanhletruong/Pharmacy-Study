import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = { title: 'Quyền riêng tư | Pharmacy Study' }

export default function PrivacyPage() {
  return (
    <main className="workspace">
      <article className="panel login-panel">
        <h1>Chính sách quyền riêng tư</h1>
        <p>
          Pharmacy Study lưu thông tin để bạn đăng nhập, làm bài và xem lại tiến
          độ ôn tập.
        </p>
        <h2>Dữ liệu đăng nhập</h2>
        <p>
          Khi bạn đăng nhập bằng Google, Pharmacy Study dùng tên hiển thị, email
          đã xác minh và mã định danh do Google cấp để nhận diện tài khoản. Nếu
          chọn chế độ ẩn danh, website tạo một mã phiên riêng.
        </p>
        <h2>Bài làm và phiên truy cập</h2>
        <p>
          Website lưu câu trả lời, kết quả và tiến độ của bạn. Cookie đăng nhập
          duy trì phiên trong trình duyệt. Dữ liệu được xử lý trên Vercel, lưu
          trong PostgreSQL trên Supabase và sao lưu dưới dạng mã hóa trong kho
          vận hành riêng tư.
        </p>
        <h2>Quản lý dữ liệu</h2>
        <p>
          Bạn có thể đăng xuất trên website và thu hồi quyền đăng nhập qua phần
          kết nối với bên thứ ba trong tài khoản Google. Để hỏi về dữ liệu hoặc
          yêu cầu truy cập, sửa hay xóa dữ liệu đã lưu, hãy liên hệ qua địa chỉ
          hỗ trợ của Pharmacy Study trên màn hình cấp quyền của Google.
        </p>
        <Link href="/">Về trang chủ</Link>
      </article>
    </main>
  )
}
