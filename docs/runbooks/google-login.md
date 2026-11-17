# Đăng nhập Google cho lớp được mời — P03

Code đã có; đăng nhập Google thật chưa được kiểm chứng vì môi trường hiện tại không có OAuth client của website. E2E dùng provider thử riêng, không thay thế bước kiểm Google dưới đây. Chưa triển khai hosting.

## Chuẩn bị local

Dùng clone/worktree riêng nhánh `phase-03`; bảo toàn clone Windows có capture NotebookLM private. Node 24, pnpm 11.25.0 và Docker như P02. Không ghi đè `.env` đã có.

Với DB local mới: copy `.env.example` thành `.env`, `pnpm install --frozen-lockfile`, rồi:

```sh
docker compose -f infra/docker-compose.yml up -d --wait
pnpm db:migrate
pnpm db:provision -- --write-local-env
pnpm db:seed
pnpm db:migrate
```

Migration đầu dùng credential bootstrap trong example; sau provision, `.env` chứa DATABASE_URL của login ít quyền `pharmacy_app`. `.env.db` giữ BOOTSTRAP_DATABASE_URL và MIGRATION_DATABASE_URL riêng cho CLI. Hai file đều private/ignore. Không đưa `.env.db` hoặc credential bootstrap/migrator vào process web hay hosting. Helper chỉ hỗ trợ localhost, không tự đổi mật khẩu role đã tồn tại; cần credential hiện tại khi chạy lại. Với DB P02 có dữ liệu, sao lưu và áp dụng forward migration, không xóa volume hoặc sửa migration đã chạy.

## Cấu hình OAuth riêng tư

1. Trong Google Cloud / Google Auth Platform, tạo project hoặc dùng project phù hợp, cấu hình consent screen, rồi OAuth client loại **Web application** với scope cơ bản `openid email profile`. Nếu Audience ở chế độ Testing, thêm các tài khoản thử vào Google Test users.
2. Chọn một hostname/cổng nhất quán, ví dụ `http://localhost:3001`. Authorized redirect URI chính xác: `http://localhost:3001/api/auth/callback/google`. Nếu cấu hình JavaScript origin thì dùng `http://localhost:3001`. Không trộn `localhost` với `127.0.0.1`.
3. Điền riêng trong `.env`: AUTH_MODE=oidc, PORT=3001, NEXTAUTH_URL và APP_ORIGIN cùng `http://localhost:3001`, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET; ADMIN_EMAILS là email Google của chủ dự án; INVITED_EMAILS là danh sách email lớp, phân cách bằng dấu phẩy. Admin tự nằm trong allowlist; không hỗ trợ wildcard hoặc đăng ký tự do.
4. Tạo NEXTAUTH_SECRET ngẫu nhiên tối thiểu 32 ký tự, ví dụ chạy local `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`, rồi lưu trực tiếp vào cấu hình private. Không gửi key, secret, cookie hoặc output này vào chat/Git.
5. Chạy `pnpm dev`; mở `http://localhost:3001`. Khi đổi danh sách mời hoặc cấu hình phải restart server.

Google OAuth của website độc lập phiên MCP NotebookLM. Không copy cookie NotebookLM; gói ChatGPT Pro không cung cấp OAuth client hoặc API credit cho website.

## Kiểm chứng Google thật còn phải làm

- Đăng nhập một admin, một học viên được mời; kiểm tên/vai trò và `/admin`. Tài khoản ngoài danh sách phải bị từ chối. Google phải trả email đã xác minh.
- Hai học viên không đọc/ghi/nộp attempt của nhau; admin cũng không được đọc attempt người khác chỉ vì có vai trò admin.
- Đăng xuất rồi kiểm phiên cũ không còn truy cập. Ghi kết quả pass/fail và thời điểm vào handoff, không ghi cookie/token/email thật vào báo cáo public.

Session tối đa 8 giờ, có bản ghi DB để revoke; user disabled bị chặn ở request tiếp theo. Sau đổi cấu hình, loại khỏi allowlist/hạ quyền có hiệu lực ở request tiếp theo; nâng lên admin cần đăng nhập lại. Khôi phục admin bằng sửa ADMIN_EMAILS chính xác, restart và đăng nhập lại; kiểm cả trạng thái user nếu trước đó bị disabled. Mọi chỉnh DB quản trị dùng maintenance credential ngoài web. Không có giao diện quản lý user trong P03.

`AUTH_MODE=dev` chỉ dành local, `test` chỉ E2E với secret giả; cả hai bị từ chối ở production. Production OIDC yêu cầu HTTPS và runtime DB ít quyền. Không đổi sang dev để chữa cấu hình production.

## Giới hạn vận hành

Mặc định mỗi actor tạo/nộp bài tối đa 20 lần/phút, ghi item 120 lần/phút. Auth dùng ngân sách chung anonymous 120 request/phút lưu PostgreSQL, chưa phân phối theo IP và không tin X-Forwarded-For. Giới hạn trả 429/Retry-After. CSP script theo nonce; style inline được giữ cho KaTeX. Nhật ký không lưu access token/refresh token hoặc body thô. Quản lý vòng đời dữ liệu/log và hosting thuộc các phase sau.
