# Pharmacy-Study

Web ôn thi cho 5 môn Dược. P02 có luồng luyện 10 câu tổng hợp; P03 đã triển khai đăng nhập/phân quyền cho lớp được mời, còn chờ kiểm Google thật. Chưa có ngân hàng đề chuyên môn hoặc hosting production. Plan gốc: `IMPLEMENTATION_PLAN.md`; tiến độ thực tế: `docs/status.md`.

## Yêu cầu

- Node.js 24 LTS (`.nvmrc`).
- pnpm 11.25.0 (`packageManager` trong `package.json`). Có thể dùng Corepack hoặc cài đúng phiên bản qua npm.
- Docker Engine và Docker Compose v2 để chạy PostgreSQL local.

## Bắt đầu

```bash
cd Pharmacy-Study
pnpm install --frozen-lockfile
cp .env.example .env
# Chỉ cần copy .env một lần; không ghi đè file đã cấu hình.
docker compose -f infra/docker-compose.yml up -d --wait
pnpm db:migrate
pnpm db:provision -- --write-local-env
pnpm db:seed
pnpm dev
```

Mở http://localhost:3000 trong trình duyệt của môi trường hoặc dùng preview/chuyển tiếp cổng 3000 của Codex. Dev server cho phép kết nối từ môi trường Cloud. Example mặc định AUTH_MODE=dev chỉ dùng local với user cố định. Để dùng Google cho lớp, cấu hình theo [runbook P03](docs/runbooks/google-login.md); endpoint `GET /api/v1/health` trả `200 { "status": "ok" }`.

Launcher đọc `.env` ở gốc repo. Provision ghi credential runtime ít quyền vào `.env`, giữ maintenance trong `.env.db` riêng. Không đưa `.env.db` vào web/hosting, không đưa secret vào `NEXT_PUBLIC_*`. Với DB đang có dữ liệu, sao lưu và áp dụng migration, không xóa volume.

## Lệnh đã được thiết lập

| Lệnh                                | Công dụng                                                   |
| ----------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                          | Next.js development, cổng 3000                              |
| `pnpm lint`                         | ESLint, quy tắc Next.js và TypeScript                       |
| `pnpm typecheck`                    | Kiểm tra strict TypeScript cho core và web, tạo route types |
| `pnpm test`                         | Vitest: grading, health, auth config và ma trận quyền       |
| `pnpm format:check`                 | Kiểm tra định dạng                                          |
| `pnpm exec prettier --write <file>` | Format đúng file vừa sửa                                    |
| `pnpm build`                        | Build Next.js production, kèm kiểm tra TypeScript           |
| `pnpm start`                        | Chạy bản production đã build, cổng 3000                     |

Chỉ chạy kiểm tra có liên quan theo `AGENTS.md`. Chuỗi lint/typecheck/test/build là kiểm chứng bắt buộc của P00; không phải quy trình mặc định sau mỗi chỉnh sửa. Không suy ra coverage tổng thể từ số test đã pass.

Đã có `db:migrate`, `db:provision`, `db:seed`, `test:integration`, `e2e`, `security:test` và `audit:security`. Các lệnh `content:*` và AI runtime còn **to be established** ở phase tương ứng. E2E login dùng provider thử riêng, không chứng minh callback Google thật hoạt động.

## Cấu trúc

```text
apps/web/             Next.js App Router, luyện mẫu và auth/guard
packages/core/        Grading, authorize và tests
infra/                PostgreSQL Docker Compose local
.github/workflows/    CI theo phase hiện hành
docs/adr/             Quyết định đề xuất/được duyệt và các quyết định OPEN
docs/status.md        Trạng thái task và kết quả kiểm chứng
docs/blockers.md      Thông tin còn thiếu và phase bị chặn
handoff.md            Bàn giao gần nhất
worked.md             Lịch sử phần phát sinh ngoài plan
```

`packages/db` và `packages/api-contract` đã có. Calc-engine, chem-render sản phẩm và content-pipeline chờ phase liên quan; spike không được tính là tính năng sản phẩm.

## PostgreSQL local

```bash
docker compose -f infra/docker-compose.yml ps
docker compose -f infra/docker-compose.yml exec postgres pg_isready -U pharmacy_dev -d pharmacy_study
docker compose -f infra/docker-compose.yml stop
```

Database chỉ publish trên loopback `127.0.0.1`, mặc định cổng 5432. Named volume giữ dữ liệu khi restart. Không chạy `down -v` nếu cần giữ dữ liệu. Mật khẩu minh họa chỉ dùng local và CI; production chốt ở ADR-0006.

## CI và kiểm tra secret

GitHub Actions kiểm tra frozen install, lint, format, strict TypeScript, unit smoke, build, HTTP health và Git history bằng gitleaks 8.30.1. PostgreSQL service phải healthy. SHA của action và checksum bản gitleaks được ghim trong workflow. Các cổng integration/e2e/migration/authz được thêm khi phase triển khai chúng; không báo đạt khi chưa tồn tại.

Sau khi đã cài gitleaks 8.30.1 từ release chính thức và kiểm checksum, có thể chạy:

```bash
gitleaks git . --redact --no-banner --log-opts=--all
```

## Tiếp tục và hoàn tác

Đọc `AGENTS.md`, `docs/decision-register.md`, `docs/status.md` và `handoff.md` trước khi sửa. P00 dừng tại cổng phase; chưa tự bắt đầu P01/P02.

Starter Vite trước khi chuyển kiến trúc được giữ ở commit `39ffc0b` và nhánh local `baseline-vite`. Có thể xem bằng `git show` hoặc checkout vào worktree khác để tham chiếu; không reset đè thay đổi hiện tại. Chuyển framework là quyết định trực tiếp của chủ dự án ngày 2026-11-12.

pnpm 11 đọc cấu hình dự án trong `pnpm-workspace.yaml`. Store/cache đặt trong `.pnpm-store/` của checkout và bị Git bỏ qua để chạy được trong workspace Cloud giới hạn quyền ghi; không ghi cấu hình global hoặc token vào repo. VS Code dùng ESLint và Prettier được đề xuất, format khi lưu.
