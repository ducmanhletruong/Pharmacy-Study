# Bàn giao sửa đợt2

Worktree `/workspace/pharmacy-study-cr0001`, branch `fix-review-recovery-security`, base `fix-review-p1`.
Nguồn trạng thái/kiểm chứng: [docs/status.md](docs/status.md), mục đợt2.
Scope RV-03..08, RV-13, RV-15; đợt3 còn OPEN, P1 giữ nguyên.

Auth giữ CSRF, lỗi revoke trả503 không clear session; UI báo chưa xong và cho retry.
Quota signed logout riêng; anonymous signed-cookie budget + global cap, không tin header IP.
UI chống stale response và phục hồi link attempt lỗi.
Provision dùng journal/lock .env.provision.*, maintenance env ghi trước runtime env.
Nếu lock stale: kiểm không có CLI chạy, chỉ xóa lock rồi retry; giữ journal private.
Recorder lock cùng capture: xác nhận không có writer trước khi xóa stale lock, không xóa capture.
Xem docs/runbooks/recovery-security.md và Google runbook.

PR #7 draft đã mở, CI code cuối đạt; bằng chứng/giới hạn ở docs/status.md.
Đợt3 còn RV-09/10/11/12/14/16; không tự mở rộng scope.
Không copy journal/maintenance env vào web hoặc gửi secret trong chat/Git.
Không merge/deploy, đổi Google thật, chạy lại P01 hoặc mở P04.
