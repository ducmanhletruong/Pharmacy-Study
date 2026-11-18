# Bàn giao đợt3 review

Worktree `/workspace/pharmacy-study-cr0001`, branch `fix-review-data-completion`, base `fix-review-recovery-security`.
Nguồn trạng thái/kiểm chứng: [docs/status.md](docs/status.md).
Scope RV-09/10/11/12/14/16, không mở workflow P04.
Migration0005 thêm ledger seal/lock rows và topic snapshot, không sửa0001–4.
Legacy backfill chỉ biết metadata lúc nâng cấp; submitted result giữ nguyên.
Xem [runbook lịch sử](docs/runbooks/data-history.md) và retry toàn transaction khi40001/40P01.
Các writer không tắt trigger hoặc xóa ledger để sửa nội dung đã sealed.
Dropdown render đủ cấp, contract counts chặt, evaluator không pass fixture rỗng.
Đang hoàn tất CI/PR; kết quả mới nhất ở docs/status.md.
Google live P03 còn pending; không merge/deploy hoặc tự mở P04.
