# Bàn giao

Cập nhật: 2026-11-17 (Asia/Saigon). Repo /workspace/web-starter, branch phase-02 dựa trên phase-01.

## Trạng thái

P00 và P01 DONE trong phạm vi local/spike. P01-T01 đã có 15 observation của năm chủ đề qua 12/11, 13/11 và 17/11; owner trực tiếp duyệt grounding và điều khoản. Không còn yêu cầu chờ ba ngày hoặc xử lý hai pending cũ. Bằng chứng private ở Windows, Cloud chỉ đối chiếu final/lịch sử.

P02 DONE: local và CI đã đạt. Chỉ một môn tổng hợp tự viết với 10 MCQ, user dev cố định. Không AI runtime, auth thật hoặc hosting production. Không bắt đầu P03.

## Đã thay đổi P02

- packages/db: migration 0001 cho 9 bảng, migration checksum/lock, seed idempotent và revision snapshot; Drizzle SQL và PostgreSQL pool. Không xóa data/volume.
- packages/core: validator và grading MCQ; đúng bốn label A/B/C/D và một đáp án đúng.
- packages/api-contract: Zod request/response; API-01..06 trong app. Không gửi correct_answer/is_correct/explanation trong đề; chỉ feedback sau đáp án.
- API có owner scope, Origin (loopback mặc định, APP_ORIGIN cho proxy), idempotency khóa theo user/key, khóa parent attempt để answer/submit không race; freeze đáp án và kết quả đã nộp.
- UI chọn bộ/chủ đề, luyện từng câu, giải thích nguồn tổng hợp, lưu/resume bằng URL attempt, tổng kết chủ đề, KaTeX; kiểm desktop/mobile.
- Launcher dev đọc .env; launcher production chặn AUTH_MODE=dev trước khi mở cổng, instrumentation kiểm độc lập. Không copy .env thật vào Git.
- CI phase-02 gồm migration/seed lặp, unit/integration/contract/E2E, build, guard, audit và secret scan. CI f771a7b đã success: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44133096057 .

## Cách chạy

Xem docs/runbooks/local-practice.md. Node24/pnpm11.25.0/Docker; tạo .env từ example nếu chưa có; pnpm install --frozen-lockfile; docker compose -f infra/docker-compose.yml up -d --wait; pnpm db:migrate; pnpm db:seed; pnpm dev. Mở http://localhost:3000. Không overwrite checkout Windows đang lưu capture private; dùng clone riêng phase-02 nếu cần.

## Kiểm chứng

Local: migration DB rỗng và seed/rerun đạt, unit 3/3, integration/contract 7/7, E2E Chromium 2/2 (10 câu/reload/result và mobile), production build đạt, check-production-guard exit 0. Audit: 0 high/critical, 1 moderate minimatch. Lint/format và gitleaks29 commit đạt. CI f771a7bc11b8e52753fa068cad2bb8ad2e5ba115 success; PR #3 draft, base phase-01: https://github.com/ducmanhletruong/Pharmacy-Study/pull/3 . Bổ sung sau code đã kiểm chỉ đổi Markdown. Không claim kiểm mọi browser, độ chính xác chuyên môn hoặc API AI.

## Bước sau

P02 đã kết thúc; chờ giao P03 và câu trả lời Q3 về phạm vi người dùng. OpenAI đã chốt nhà cung cấp; API entitlement/model/cost/OAuth còn mở cho P06. Hosting production hoãn theo quyết định local ADR-0011. Các PR trước giữ draft, không merge/deploy.

## Bảo toàn và phát sinh

Cloud vừa resume với workspace không còn checkout/runtime cũ: đã clone từ remote, không truy cập/copy phiên Google Windows. Docker volume ở Cloud mới tạo cho seed tổng hợp; không tác động máy riêng. Không cài lại MCP hay làm lại spike/RDKit. Plan gốc và AGENTS giữ nguyên. Nhật ký đầy đủ ở worked.md.
