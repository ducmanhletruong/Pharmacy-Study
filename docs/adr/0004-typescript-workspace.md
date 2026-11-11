# ADR-0004 — TypeScript và pnpm monorepo

- Trạng thái: Accepted.
- Ngày: 2026-11-12 (Asia/Saigon).
- Nguồn: IMPLEMENTATION_PLAN.md v0.1, mục 4.1.

## Bối cảnh

Starter ban đầu là React + TypeScript + Vite. Plan đề xuất Next.js App Router trong pnpm workspace.

## Quyết định / đề xuất

Chủ dự án đã chọn “Chuyển sang Next.js + pnpm theo plan (đề xuất)” trong chat ngày 2026-11-12. Dùng TypeScript strict, apps/web và packages/core trong P00. Node.js 24 LTS, pnpm 11.25.0. Phiên bản cụ thể được ghi trong package.json và pnpm-lock.yaml.

## Phương án khác

Giữ Vite và điều chỉnh kiến trúc; không được chọn.

## Điều kiện và hệ quả

Người quyết: chủ dự án. Starter cũ được lưu ở commit 39ffc0b và nhánh local baseline-vite. Không suy rộng quyết định này thành duyệt các ADR khác.
