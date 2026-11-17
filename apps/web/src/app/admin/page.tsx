import Link from 'next/link'
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
          Tài khoản của bạn có quyền quản trị. Chỉ các thành viên được mời mới
          có thể vào lớp; mỗi người chỉ truy cập bài làm của mình.
        </p>
        <Link href="/">Quay lại luyện tập →</Link>
      </section>
    </main>
  )
}
