# ADR-0001 — Modular monolith

- Trạng thái: PROPOSED.
- Ngày: 2026-11-12 (Asia/Saigon).
- Nguồn: IMPLEMENTATION_PLAN.md v0.1, mục 4.1.

## Bối cảnh

Đội ngũ nhỏ, cần một ứng dụng dễ triển khai và phân quyền theo đối tượng.

## Quyết định / đề xuất

Đề xuất Next.js + PostgreSQL, một ứng dụng modular monolith; không microservice. P00 chỉ thiết lập khung Next.js theo lựa chọn trực tiếp của chủ dự án ngày 2026-11-12.

## Phương án khác

Next.js + BaaS; site tĩnh + JSON cho trường hợp một người dùng.

## Điều kiện và hệ quả

Chưa coi toàn bộ kiến trúc sản phẩm là Accepted; chủ dự án duyệt trước các phase sau P00.
