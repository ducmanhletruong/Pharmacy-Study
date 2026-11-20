# Bàn giao Google + ẩn danh

Worktree `/workspace/pharmacy-study-cr0001`, branch `feat-open-access`, base `phase-04`.
Trạng thái và bằng chứng: [docs/status.md](docs/status.md).
User yêu cầu bỏ whitelist learner; Google verified email vào học, ADMIN_EMAILS chỉ phân quyền admin.
INVITED_EMAILS cũ không dùng. Guest luôn learner, identity UUID riêng do server tạo.
Migration0008 đã áp DB verified; không sửa migration cũ hoặc xóa dữ liệu.
Session ẩn danh tối đa8 giờ; logout/mất cookie không khôi phục, không tự ghép vào Google.
Private env được giữ nguyên; Google OAuth thật vẫn chưa kiểm.

```sh
pnpm db:migrate
pnpm dev
```

AUTH_MODE=oidc cho Google + ẩn danh; AUTH_MODE=guest chỉ ẩn danh, không cần OAuth client/admin list.
Cả hai cần NEXTAUTH_SECRET, NEXTAUTH_URL, APP_ORIGIN đúng; production HTTPS và app DB ít quyền.
Xem [runbook](docs/runbooks/google-login.md), ADR-0008 và `.env.example`.
Cloud dùng pnpm store `/workspace/web-starter/.pnpm-store`.
Đã chốt kiểm chứng và CI; PR #10 draft, bằng chứng ở status.
Không đổi giáo trình, merge/deploy hoặc tự mở P05.
