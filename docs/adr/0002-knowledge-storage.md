# ADR-0002 — Nguồn kiến thức và database

- Trạng thái: PROPOSED.
- Ngày: 2026-11-12 (Asia/Saigon).
- Nguồn: IMPLEMENTATION_PLAN.md v0.1, mục 4.1.

## Bối cảnh

Cần luyện được khi NotebookLM hoặc AI không phản hồi (AC-7).

## Quyết định / đề xuất

NotebookLM cung cấp kiến thức lúc sinh câu; PostgreSQL lưu ngân hàng đã duyệt, tài khoản và lịch sử. P00 chỉ chạy PostgreSQL local, chưa tạo schema.

## Phương án khác

Xuất nguồn thủ công; bundle JSONL là định dạng bàn giao có thể di chuyển.

## Điều kiện và hệ quả

Chờ D-01 và Q1; không tự coi NotebookLM là database runtime.
