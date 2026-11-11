# ADR-0005 — Drizzle và SQL migration

- Trạng thái: PROPOSED.
- Ngày: 2026-11-12 (Asia/Saigon).
- Nguồn: IMPLEMENTATION_PLAN.md v0.1, mục 4.1.

## Bối cảnh

Cần schema có truy vết, seed tổng hợp và migration kiểm tra được trên database rỗng.

## Quyết định / đề xuất

Đề xuất Drizzle ORM với SQL migration forward-only; mở rộng rồi thu hẹp, không migration phá dữ liệu trong MVP.

## Phương án khác

Prisma là phương án thay thế trong plan.

## Điều kiện và hệ quả

Chưa cài ORM hoặc tạo migration ở P00. Thiết lập ở P02 sau khi đủ tiên quyết.
