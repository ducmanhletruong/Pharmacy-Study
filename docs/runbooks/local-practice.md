# P02 — chạy luồng luyện mẫu trên máy local

Dùng Node.js 24, pnpm 11.25.0 và Docker đang chạy. Chỉ dữ liệu tổng hợp tự viết; không cần NotebookLM hoặc API key để luyện 10 câu mẫu.

Nếu checkout Windows phase-01 đang có thay đổi/bằng chứng private, giữ nguyên. Có thể clone riêng nhánh phase-02 vào thư mục mới; không reset/clean hoặc ghi đè checkout đó.

```powershell
git clone --branch phase-02 https://github.com/ducmanhletruong/Pharmacy-Study.git Pharmacy-Study-P02
cd Pharmacy-Study-P02
if (!(Test-Path .env)) { Copy-Item .env.example .env }
pnpm install --frozen-lockfile
docker compose -f infra/docker-compose.yml up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Trên Linux/macOS, thay dòng Copy-Item bằng `[ -f .env ] || cp .env.example .env`. Không ghi đè .env đang có. Nếu Postgres dùng cổng khác, đặt POSTGRES_PORT và DATABASE_URL khớp nhau trong .env.

Mở http://localhost:3000, chọn “Môn mẫu tổng hợp”, chủ đề và số câu rồi bắt đầu. Gửi đáp án để xem lời giải/nguồn; có thể chuyển câu, kết thúc sớm hoặc làm đủ bài để xem điểm trên thang 10 và tổng hợp theo chủ đề. Câu chưa trả lời được tính vào tổng số câu, không được tính đúng.

Bài được lưu trong PostgreSQL sau khi gửi đáp án. URL có `?attempt=...` cho phép tải lại để tiếp tục; giữ URL nếu muốn mở lại. Đây là user dev cố định, không có đăng nhập hoặc dữ liệu của nhiều người. Giải thích xuất hiện sau khi trả lời, không gửi kèm đề ban đầu. Đáp án đã lưu không đổi được; tạo bài mới để luyện lại.

## Kiểm tra có mục tiêu

```sh
pnpm test
pnpm test:integration
pnpm exec playwright install chromium
pnpm e2e
```

Migration và seed phải chạy trước integration/e2e. Tests integration chỉ dọn các attempt do chúng tạo, không truncate ngân hàng hoặc bài làm khác. Trên Linux có Chromium cài sẵn, có thể dùng `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium pnpm e2e` thay vì tải browser mới. Trong PowerShell, đặt biến môi trường tương ứng nếu muốn dùng executable có sẵn.

## Phạm vi chạy và chốt chặn

`pnpm dev` đọc .env riêng qua launcher Node; không ghi env lên Git. `AUTH_MODE=dev` chỉ dành cho phát triển. `pnpm start` từ chối chế độ dev trước khi Next mở cổng; instrumentation còn kiểm tra độc lập. Production chưa có auth thật trong P02 nên không bật luồng luyện bằng danh tính dev ở đó.

Mutation yêu cầu Origin khớp địa chỉ local và chỉ mặc định cho localhost/127.0.0.1/IPv6 loopback. Nếu dùng reverse proxy/Cloud preview, đặt APP_ORIGIN là URL gốc chính xác của preview, gồm scheme và port nếu có; không dùng wildcard hoặc tắt kiểm tra Origin. allowedDevOrigins trong Next chỉ cho hai host loopback để HMR hoạt động; preview có hostname riêng cần khai báo đúng host phát triển khi sử dụng.

`pnpm db:migrate` chỉ chạy SQL forward-only, kiểm checksum migration đã áp dụng và khóa migration đồng thời. Seed chạy lại không ghi đè revision hoặc xóa attempts. Không xóa Docker volume để cập nhật; chỉ phục hồi/xóa DB nếu đó là DB thử riêng và đã chủ động quyết định bỏ dữ liệu.

## CR-0001 trên nhánh hiện tại

Hướng dẫn P02 phía trên dành checkout phase-02. Với phase-02-hardening kế thừa P03, dùng docs/runbooks/google-login.md (migrate/provision/seed), không lấy credential bootstrap chạy web. `DEV_HOST` mặc định127.0.0.1; để xem qua Cloud port preview đặt DEV_HOST=0.0.0.0 riêng, vẫn giữ Origin chính xác. Pool/payload cấu hình qua DB_POOL_MAX/MAX_BODY_BYTES như README, không tắt guard. Production thiếu APP_ORIGIN sẽ từ chối startup.

Không sửa trực tiếp revision/choices sealed. Importer sau này phải insert revision và4choices trong transaction rồi đổi current_revision_id. Migration kiểm data cũ sai và rollback; không xóa volume hoặc tự sửa nội dung giáo trình để vượt kiểm.
