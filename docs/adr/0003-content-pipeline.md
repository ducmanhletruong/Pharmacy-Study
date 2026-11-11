# ADR-0003 — Pipeline offline trên máy admin

- Trạng thái: PROPOSED.
- Ngày: 2026-11-12 (Asia/Saigon).
- Nguồn: IMPLEMENTATION_PLAN.md v0.1, mục 4.1.

## Bối cảnh

Phiên NotebookLM và khóa LLM không được đưa vào server production.

## Quyết định / đề xuất

Đề xuất CLI trên máy admin, qua adapter KnowledgeSource/LlmProvider, xuất bundle để import và duyệt trước khi phục vụ.

## Phương án khác

Sinh trực tiếp mỗi lượt làm bài hoặc worker trên server; chưa chọn.

## Điều kiện và hệ quả

Chờ Q1, Q5 và Q6. Không tích hợp tài khoản thật trong P00.
