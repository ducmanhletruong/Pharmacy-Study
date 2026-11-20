# Bàn giao — Google OAuth local đã vào được

Trạng thái/bằng chứng: docs/status.md; checklist: docs/runbooks/google-login.md.
Repo: C:/Users/ADMIN/Documents/Codex/2026-11-21/github-plugin-github-openai-curated-remote/work/Pharmacy-Study.
Branch feat-open-access, HEAD3557814; PR10 đã merge vào phase-04 theo GitHub.
Repo System32 và repo phase-01/private capture cũ giữ nguyên.
Google thật: admin vào trang học và /admin, reload giữ phiên, logout thu hồi DB đã kiểm.
Google learner thứ hai/cách ly attempt/disabled/replay cookie thật chưa kiểm; P03 chưa đóng toàn bộ.
Tab đang mở http://localhost:3001/login; owner đã được logout để kiểm revoke.
Server pnpm dev và DB vẫn chạy; server session35115 chỉ dùng trong lượt hiện tại.
Không cần chạy lại migration/provision/seed khi resume nếu DB hiện tại còn nguyên.

Node24 có sẵn:
C:/Users/ADMIN/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe.
Prepend thư mục Node này vào PATH trong phiên; pnpm trong repo dùng11.25.0.
Nếu web dừng: vào repo rồi pnpm dev (localhost:3001).
Docker CLI: C:/Users/ADMIN/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe.
DB: Compose project pharmacy-oauth-resume, volume riêng, bind127.0.0.1:55432.
Nếu DB dừng: docker compose --env-file .env -p pharmacy-oauth-resume -f infra/docker-compose.yml up -d --wait.
.env/.env.db/.env.provision.json private và bị ignore; không in/commit secret.
Không đổi PG Windows5432, DB Cloud hoặc volume pharmacy-study cũ.

Bước tiếp: owner đăng nhập Google bằng tài khoản learner không thuộc ADMIN_EMAILS.
Sau đó kiểm learner không vào admin, ownership giữa hai learner và admin/learner theo runbook.
Chỉ ghi pass khi đã đo đúng trường hợp, không suy live từ CI/mock.
Không xóa volume/sửa migration đã áp, merge/deploy hoặc tự mởP05.

## Thay đổi mới nhất — DevTools

Chỉ admin có dấu data-devtools từ server trong development; login/guest/learner ẩn portal.
File sửa: apps/web/src/app/layout.tsx, globals.css; test: tests/e2e/devtools.spec.ts.
E2E mục tiêu1/1 đạt qua admin/logout/learner/guest/reload; không kiểm Google lại.
OAuth server đã khôi phục, executor session35115; /login không còn DevTools.
Hydration trong ảnh đã tái hiện: Grammarly thêm hai thuộc tính body; đã sửa tại body.
Đây là điều khiển hiển thị; không coi next dev endpoints đã có ACL admin.

Grammarly regression đỏ trước sửa, xanh sau sửa; hai E2E DevTools đạt, xem status.
Owner tải lại trang để loại overlay/bundle cũ; OAuth server đã khôi phục.
