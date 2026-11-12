# ADR-0011 — Tiếp tục local ở giai đoạn hiện tại

- Trạng thái: **Accepted**.
- Ngày: 2026-11-12 (Asia/Saigon).
- Người quyết: chủ dự án, qua câu trả lời trực tiếp “Tiếp tục local, chưa triển khai hosting production (đề xuất)”.
- Supersedes phần lựa chọn môi trường hiện tại của đề xuất ADR-0009. ADR-0006 về hosting production vẫn OPEN; không suy rộng quyết định này thành duyệt một nhà cung cấp production hoặc thay đổi mục tiêu availability.

## Quyết định

Tiếp tục phát triển trong môi trường local/Cloud dev đã có, dùng Next.js và PostgreSQL Compose hiện tại. Chưa triển khai Render, Neon hoặc hosting production. Không tạo tài khoản, tài nguyên trả phí hoặc cấu hình billing hosting trong giai đoạn này.

## Hệ quả và cổng còn lại

P01-T03 đã có hồ sơ và quyết định môi trường cho giai đoạn hiện tại; không còn phải chờ chọn preview/paid hosting để tiếp tục phần local. Chi phí và nhà cung cấp production được hoãn, chưa có quyết định thay thế cho ADR-0006.

Cổng P01 toàn phần vẫn chưa đạt khi thiếu bằng chứng NotebookLM và quyền truy cập OpenAI/model run. Theo plan, cổng production hosting sẽ cần được giải quyết trước khi phát hành; quyết định local này không chứng minh NFR uptime, backup hoặc tải trang production.

## Kiểm chứng và hoàn tác

Chỉ ghi quyết định; không sửa cấu hình chạy hoặc dữ liệu nên không build/test lại. Khi chủ dự án chọn triển khai, tạo ADR mới cho provider, budget và phạm vi, dẫn chiếu thay thế quyết định local theo phạm vi được duyệt.
