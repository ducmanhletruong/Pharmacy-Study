# Bàn giao CR-0001

Worktree `/workspace/pharmacy-study-cr0001`, branch `phase-02-hardening`, base `phase-03`.
Nguồn trạng thái/kiểm chứng: [docs/status.md](docs/status.md).
Phạm vi/rủi ro: [ADR-0012](docs/adr/0012-db-integrity.md) và [phụ lục plan0.2](docs/plans/IMPLEMENTATION_PLAN.v0.2-addendum.md).

Đã áp dụng hardening DB, gộp choices query, tests, config và quy tắc tài liệu theo CR.
Migration mới0003, không sửa0001/0002 hoặc mất auth P03.
DB thử riêng, `.env`/`.env.db` private; không đổi DB/server P02/P03 hoặc Windows capture.

Chạy: frozen install → db:migrate → db:provision (nếu clone mới) → db:seed → pnpm dev.
Xem [runbook Google](docs/runbooks/google-login.md), config pool/body/DEV_HOST ở README.
Cloud preview chủ động đặt DEV_HOST=0.0.0.0; local mặc định127.0.0.1.
Production cần APP_ORIGIN chính xác; Google OAuth client vẫn cấu hình private, không gửi secret chat.

Đang hoàn tất kiểm E2E/build/CI và PR draft; xem status để biết kết quả mới nhất.
Không merge PR, deploy hoặc bắt đầu P04. By_topic nhiều chủ đề còn chờ quyết định trước P05.
Không xóa volume hoặc chạy rollback SQL trong CR gốc lên data thật; dùng forward migration được review.
Các phát sinh/khác biệt với đề xuất gốc đã nối vào worked.md.
