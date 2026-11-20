# Đăng nhập Google công khai và chế độ ẩn danh

Code đã có; đăng nhập Google thật chưa được kiểm chứng vì môi trường hiện tại không có OAuth client của website. E2E dùng provider thử riêng, không thay thế bước kiểm Google dưới đây. Chưa triển khai hosting.

## Chuẩn bị local

Dùng clone/worktree riêng nhánh chứa thay đổi open-access mới nhất; bảo toàn clone Windows có capture NotebookLM private. Node 24, pnpm 11.25.0 và Docker như P02. Không ghi đè `.env` đã có.

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
3. Điền riêng trong `.env`: AUTH_MODE=oidc, PORT=3001, NEXTAUTH_URL và APP_ORIGIN cùng `http://localhost:3001`, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET; ADMIN_EMAILS là các email Google được cấp quyền quản trị (exact match), có thể để trống nếu chưa cần admin. Mọi email Google hợp lệ đã xác minh đều có thể vào học; INVITED_EMAILS cũ không còn được sử dụng.
4. Tạo NEXTAUTH_SECRET ngẫu nhiên tối thiểu 32 ký tự, ví dụ chạy local `node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"`, rồi lưu trực tiếp vào cấu hình private. Không gửi key, secret, cookie hoặc output này vào chat/Git.
5. Chạy `pnpm dev`; mở `http://localhost:3001`. Khi đổi danh sách admin hoặc cấu hình phải restart server.

Google OAuth của website độc lập phiên MCP NotebookLM. Không copy cookie NotebookLM; gói ChatGPT Pro không cung cấp OAuth client hoặc API credit cho website.

## Kiểm chứng Google thật còn phải làm

- Đăng nhập một admin và một học viên chưa từng được mời; cả hai vào được website nhưng chỉ admin vào được `/admin`. Google phải trả email đã xác minh, tài khoản disabled vẫn bị chặn.
- Hai học viên không đọc/ghi/nộp attempt của nhau; admin cũng không được đọc attempt người khác chỉ vì có vai trò admin.
- Đăng xuất rồi kiểm phiên cũ không còn truy cập. Ghi kết quả pass/fail và thời điểm vào handoff, không ghi cookie/token/email thật vào báo cáo public.

Session tối đa 8 giờ, có bản ghi DB để revoke; user disabled bị chặn ở request tiếp theo. Sau đổi cấu hình, loại khỏi ADMIN_EMAILS/hạ quyền admin có hiệu lực ở request tiếp theo; nâng lên admin cần đăng nhập lại. Khôi phục admin bằng sửa ADMIN_EMAILS chính xác, restart và đăng nhập lại; kiểm cả trạng thái user nếu trước đó bị disabled. Mọi chỉnh DB quản trị dùng maintenance credential ngoài web. Không có giao diện quản lý user trong P03.

`AUTH_MODE=dev` chỉ dành local, `test` chỉ E2E với secret giả; cả hai bị từ chối ở production. Production OIDC yêu cầu HTTPS và runtime DB ít quyền. Không đổi sang dev để chữa cấu hình production.

## Giới hạn vận hành

Mặc định mỗi actor tạo/nộp bài tối đa 20 lần/phút, ghi item 120 lần/phút. Auth dùng quota120/phút theo signed rate-client cookie và global anonymous cap1200/phút; signed logout có quota riêng theo SID, không dùng ngân sách anonymous. Không tin X-Forwarded-For. Rate cookie không phải định danh chống bot; xem docs/runbooks/recovery-security.md. Giới hạn trả 429/Retry-After. CSP script theo nonce; style inline được giữ cho KaTeX. Nhật ký không lưu access token/refresh token hoặc body thô. Quản lý vòng đời dữ liệu/log và hosting thuộc các phase sau.

## Tiếp tục ẩn danh — không cần Google OAuth client

Nếu chưa cấu hình Google, đặt AUTH_MODE=guest. Vẫn cần NEXTAUTH_SECRET ngẫu nhiên tối thiểu32 ký tự, NEXTAUTH_URL và APP_ORIGIN cùng origin; production cần HTTPS. Không cần GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET hoặc ADMIN_EMAILS trong guest-only mode. Chạy migration0008 bằng maintenance credential trước khi mở web, rồi khởi động lại. AUTH_MODE=oidc cung cấp đồng thời nút Google và “Tiếp tục ẩn danh”; AUTH_MODE=dev cũ vẫn chỉ dành local với user mẫu, không phải phiên ẩn danh.

Mỗi lần chọn ẩn danh tạo một user/identity ngẫu nhiên riêng do server quyết định, luôn learner. Không thể nhập email/ID/role để nhận phiên của người khác. Phiên dùng cookie HttpOnly, SameSite=Lax, Secure ở HTTPS; DB revoke khi logout, tối đa8 giờ. Trong cùng phiên có thể tải lại để tiếp tục bài; xóa cookie, hết hạn hoặc logout sẽ mất quyền truy cập bài ẩn danh. Dữ liệu đã lưu không tự xóa ngay; cleanup/retention chưa triển khai, không cam kết xóa tài khoản sau8 giờ. Không có đồng bộ giữa thiết bị hoặc ghép bài ẩn danh vào Google.

Kiểm hai trình duyệt/contexts ẩn danh có ID khác nhau, không đọc/ghi bài nhau, admin API trả403. Callback thiếu CSRF/Origin hợp lệ phải bị chặn; cookie cũ sau logout không dùng lại được. Chế độ ẩn danh không có nghĩa server không ghi nhận hoạt động: bài làm và audit bảo mật vẫn lưu private như các phiên khác. Global auth quota và per-session learner quota hiện có vẫn áp dụng; đây không phải cơ chế chống bot theo người thật.

Đổi phạm vi truy cập không cấp quyền công khai giáo trình. Chỉ nhập nội dung được phép chia sẻ cho đối tượng thực tế; dữ liệu hiện có vẫn là synthetic. Không bật hosting production trong thay đổi này.
