# Bàn giao

## Tác vụ gần nhất

- Ngày: 2026-11-12 (Asia/Saigon).
- Yêu cầu: tạo quy định sửa code, build/test, giới hạn refactor, ưu tiên thay đổi tối thiểu và tiết kiệm usage/credits; bổ sung bàn giao và báo cáo ngoài plan.
- Kết quả: đã tạo `AGENTS.md`, `handoff.md`, `worked.md` trong thư mục dự án.
- Quy ước tên: dùng `AGENTS.md` viết hoa để agent tự nhận chỉ dẫn, tương ứng file `Agents.md` người dùng yêu cầu.
- Ngoài plan: không có.

## Trạng thái dự án

- Đường dẫn: `/workspace/web-starter`.
- Stack: React + TypeScript + Vite; Node.js 24; npm.
- Có ESLint, Prettier, TypeScript strict và cấu hình VS Code.
- Chưa cấu hình backend, database hoặc bộ test tự động.
- Không thay đổi code ứng dụng, dependency hoặc cấu hình runtime trong tác vụ tài liệu này.

## Kiểm tra

- Tác vụ hiện tại: kiểm tra nội dung và sự tồn tại của ba file; không chạy test/build vì chỉ thay đổi tài liệu.
- Tham chiếu lần setup trước: typecheck, ESLint, Prettier, build và smoke test Chromium đã đạt. Đây là kết quả trước tác vụ này, không phải lượt chạy mới.

## Tiếp tục công việc

1. Đọc `AGENTS.md`, sau đó nhận yêu cầu tính năng cụ thể từ người dùng.
2. Đọc code liên quan và nêu plan ngắn trước khi sửa.
3. Chọn kiểm tra theo mức ảnh hưởng; cập nhật bàn giao và nhật ký khi hoàn tất.

Lệnh phát triển: `cd /workspace/web-starter && npm run dev`, cổng 5173. Kiểm tra tiến trình/cổng trước khi chạy thêm; trạng thái server chưa được xác minh lại trong tác vụ tài liệu này.

## Việc còn lại / blocker

Không có phần còn lại của yêu cầu tạo ba file. Chưa có yêu cầu tính năng tiếp theo.
