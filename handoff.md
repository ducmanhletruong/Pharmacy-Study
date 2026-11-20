# Bàn giao — P03/P05 local

Trạng thái duy nhất/bằng chứng: docs/status.md; phạm vi mở rộng: docs/implementation-plan-v0.3-p05.md.
Yêu cầu owner: đóng P03, làm P05; multi-topic tính mỗi topic, GPSL120/60; thêm tự luận/chấm tay.
Repo: C:/Users/ADMIN/Documents/Codex/2026-11-21/github-plugin-github-openai-curated-remote/work/Pharmacy-Study.
Branch phase-05; base feat-open-access3557814; PR10 đã merge phase-04; chưa merge/deploy thay đổi hiện tại.
P03 đóng local: Google callback/admin/logout thật + ma trận synthetic; không nhận mọi ca là nhiều account Google live.
P05 T01–T07 và tự luận private đã đạt cổng local; xem status cho kiểm chứng/CI chính xác.
Luồng /study: blueprint, mock/hạn giờ server, progress, review; /written: PDF private, lưu, nộp, tự chấm/history.
GPSL120/3600giây còn draft vì chưa có bank đủ approved; không tự tạo nội dung hoặc tỉ lệ môn.
Ba đề K79 HPT/HHC2/VSKS nạp riêng cho Google admin; PDF/text/ảnh/base64 nguồn nằm ngoài Git.
HPT reference chỉ tải sau nộp; HHC2/VSKS không tự sinh đáp án thiếu. Điểm self_assessed không phải AI.
Runbook: docs/runbooks/learner-workflows.md; Q2: docs/q2-exam-profiles.md.
Handler p95=174ms là đề10câu từ20k, chưa có TCP; HTTP local mới nhất10câu193ms/120câu284ms.
Không coi benchmark local là SLA production; báo cáo before vẫn giữ trong docs/performance/.

Runtime Node24: C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin.
Prepend Node vào PATH, pnpm trong repo11.25.0; không dùng Node26 global.
Server OAuth pnpm dev đang chạy localhost:3001; executor session1034 chỉ có giá trị lượt hiện tại.
Nếu server dừng: cd repo rồi pnpm dev, dùng private env hiện có; không đặt AUTH_MODE=test.
Docker: C:/Users/ADMIN/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe.
Compose project pharmacy-oauth-resume, volume riêng, bind127.0.0.1:55432; migrations0001–0010 đã áp.
Không cần provision/seed lại nếu DB còn nguyên; không sửa migration đã áp/xóa volume.
.env/.env.db private/ignore; không in hoặc commit credential/cookie/email/PDF thật.
Giữ nguyên repo System32, bản phase-01/private capture cũ, PG16 Windows5432 và volume/DB khác.

Bước tiếp trong scope hiện tại: đối chiếu secret scan/commit/CI ở status và phản ánh bàn giao.
Sau P05 dừng ở cổng; không tự bắt đầu P06–P12, merge hoặc deploy.
KTCT, quy tắc làm tròn/danh pháp/rubric và phân bố GPSL còn OPEN cho phase sau.
Rollback app bằng revert code có review; DB dùng forward migration, không drop dữ liệu owner.
