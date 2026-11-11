# Bàn giao

## Kết quả gần nhất

- Ngày: 2026-11-12 (Asia/Saigon).
- Hoàn thành **P00-T01…T07**, dừng tại cổng P00 của `IMPLEMENTATION_PLAN.md`.
- Chủ dự án đã chọn Next.js + TypeScript trong pnpm monorepo và cung cấp repo GitHub.
- Local: `/workspace/web-starter`; nhánh `phase-00`.
- PR nháp: https://github.com/ducmanhletruong/Pharmacy-Study/pull/1 — chưa merge.
- CI đã đạt: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43074691952, code commit `50403d8`.
- Phần bổ sung sau code commit chỉ là tài liệu/AGENTS, không đổi hành vi ứng dụng.

## Đã có

- `apps/web`: Next.js App Router, trang tên dự án, GET `/api/v1/health` trả `200 {"status":"ok"}`.
- `packages/core`: khung TypeScript strict và Vitest smoke test health contract.
- `infra/docker-compose.yml`: PostgreSQL 17.11 local, ghim digest, chỉ publish DB trên loopback.
- Công cụ lint/format/typecheck/build và CI P00; dependency ghim bằng pnpm lockfile.
- Plan upload mới nhất được lưu nguyên văn; 8 ADR, decision register, status, blockers, mẫu CR.
- Root AGENTS giữ yêu cầu sửa tối thiểu và tiết kiệm usage; `apps/web/AGENTS.md` bổ sung hướng dẫn Next.js đúng phiên bản.

## Kiểm chứng thực tế

- Checkout làm việc: install, lint, typecheck, test 1/1, build và production HTTP health/homepage đạt.
- Clone sạch: frozen install, lint, typecheck, test, build và format check đạt. Chỉ dùng chung package cache lúc cài; node_modules/.next được tạo mới, sau kiểm chứng đã bỏ symlink cache tạm và git status sạch.
- PostgreSQL local healthy; CI service cũng healthy.
- GitHub Actions P00 success, gồm gitleaks không phát hiện secret.
- Plan gốc được so byte với upload và không thay đổi.
- Không dùng kết quả starter Vite để báo đạt cho Next.js. Chưa có kiểm chứng nghiệp vụ, auth, migration hay e2e ở P00.

## Chạy và tiếp tục code

Dev server đã chạy và kiểm tra tại cổng **3000**. Trong môi trường hiện tại, mở preview cổng 3000 hoặc http://localhost:3000. PostgreSQL local cũng đang chạy. Kiểm tra tiến trình trước khi khởi động thêm.

```bash
cd /workspace/web-starter
pnpm install --frozen-lockfile
pnpm dev
```

Dùng Node 24 và pnpm 11.25.0. Hướng dẫn Compose, env và từng lệnh ở README. App P00 chưa đọc database; chưa có câu hỏi, tài khoản hoặc provider AI.

## Việc còn lại

Không còn phần implementation P00. PR đang nháp để chủ dự án xem xét; agent không tự merge. **Chưa bắt đầu P01 hoặc phase nào sau P00.**

Theo mục 10.1 và 18 của plan, trước phase sau cần duyệt tài liệu và các thông tin liên quan. P01 cần Q1 (MCP NotebookLM/quyền dùng nguồn) và Q5 (ngân sách hosting/AI, provider ưu tiên). Danh sách đầy đủ ở `docs/blockers.md`. Các quyết định OPEN/PROPOSED khác chưa được tự nâng thành Accepted.

## Hoàn tác / phát sinh

Starter Vite ở commit `39ffc0b`, nhánh local `baseline-vite`; lịch sử GitHub README được giữ qua merge `c830ffe`. Không reset đè thay đổi hoặc xóa volume DB nếu cần giữ dữ liệu. Nhật ký đầy đủ các phần lệch giả định ban đầu và lỗi đã xử lý nằm trong `worked.md`.
