# ADR-0006 — Hosting và PostgreSQL production

- Trạng thái: Accepted cho giai đoạn local theo ADR-0011; OPEN cho production.
- Ngày: 2026-11-12 (Asia/Saigon).
- Nguồn: IMPLEMENTATION_PLAN.md v0.1, mục 4.1.

## Bối cảnh

Ngân sách, hosting và staging chưa được chủ dự án xác nhận.

## Quyết định / đề xuất

Chưa chọn nhà cung cấp. Docker Compose PostgreSQL local ở P00 không phải quyết định hosting production.

## Phương án khác

Đánh giá ở P01-T03 theo Q5 và các mục tiêu RPO/RTO.

## Điều kiện và hệ quả

Chờ Q5; chủ dự án duyệt. Không tạo tài nguyên trả phí hoặc triển khai production trong P00.

## Xác nhận phạm vi — 2026-11-17

Quyết định local đã được chủ dự án chốt ngày 12/11 theo ADR-0011. Production được hoãn, không cần chọn hosting trả phí để thực hiện P02 local. Không suy ra RPO/RTO hoặc ngân sách production đã được duyệt.
