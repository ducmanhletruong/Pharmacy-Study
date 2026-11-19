import Link from 'next/link'
import { ContentAdmin } from '../../components/content-admin'
import { notFound } from 'next/navigation'
import { authorize } from '@pharmacy/core/authz'
import { currentActor } from '../../server/auth/actor'
export default async function AdminPage() {
  const actor = await currentActor()
  if (!authorize(actor, 'admin:access')) notFound()
  return (
    <main className="workspace">
      <section className="panel">
        <p className="eyebrow">PHARMACY STUDY</p>
        <h1>Khu vực quản trị lớp.</h1>
        <p>
          Kiểm tra câu hỏi và nguồn tài liệu, duyệt nội dung, xử lý phản hồi của
          học viên.
        </p>
        <Link href="/">Quay lại luyện tập →</Link>
      </section>
      <ContentAdmin />
    </main>
  )
}
