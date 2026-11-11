# Bàn giao

## Tác vụ hiện tại

- Ngày: 2026-11-12 (Asia/Saigon).
- Mục tiêu: thực hiện P00 của `IMPLEMENTATION_PLAN.md` upload mới nhất, chưa bắt đầu phase khác.
- Chủ dự án đã chọn Next.js + TypeScript trong pnpm monorepo và cung cấp repo GitHub `ducmanhletruong/Pharmacy-Study`.
- Đường dẫn local: `/workspace/web-starter`; nhánh `phase-00`; remote GitHub đã nối và bảo toàn lịch sử.

## Trạng thái

Khung code, tài liệu và CI đã được chuẩn bị; còn chờ kiểm chứng. Xem bảng task/phase tại `docs/status.md`, quyết định tại `docs/decision-register.md` và phát sinh tại `worked.md`.

## Cấu trúc mới

- `apps/web`: Next.js App Router, trang tên dự án, `GET /api/v1/health`.
- `packages/core`: TypeScript strict và smoke test.
- `infra/docker-compose.yml`: PostgreSQL local, chưa có schema/migration.
- `.github/workflows/ci.yml`: cổng P00.
- `docs/adr`: 8 ADR; chỉ ADR-0004 đã Accepted theo lựa chọn thực tế của chủ dự án.

## Cách tiếp tục

Dùng Node 24 và pnpm 11.25.0. Cài bằng `pnpm install --frozen-lockfile`, chạy web bằng `pnpm dev` ở cổng 3000. Kiểm tra tiến trình trước khi khởi động thêm. Trạng thái server Next.js chưa được xác minh ở thời điểm viết mục này.

## Kiểm chứng / phần còn lại

Chờ kiểm chứng P00 local, clean clone và CI. Không coi các lượt check starter Vite trước đó là bằng chứng cho code mới. Không tự bắt đầu P01/P02; những thông tin cần chủ dự án quyết nằm trong `docs/blockers.md`.

## Tham chiếu hoàn tác

Starter Vite ở commit `39ffc0b`, nhánh local `baseline-vite`. Lịch sử GitHub README được giữ qua commit merge `c830ffe`. Không reset đè thay đổi hiện tại hoặc xóa volume DB nếu có dữ liệu cần giữ.
