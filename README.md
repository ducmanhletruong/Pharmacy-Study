# Pharmacy-Study

Môi trường phát triển React + TypeScript + Vite. Node.js 24 LTS và npm; dependency được cố định bằng `package-lock.json`.

## Bắt đầu

```bash
cd /workspace/web-starter
npm ci
cp .env.example .env.local
npm run dev
```

Mở http://localhost:5173 trong trình duyệt của môi trường. Khi truy cập từ máy riêng, dùng preview/chuyển tiếp cổng 5173 của Codex. Nếu cổng đang được dùng, dừng tiến trình cũ trước khi chạy lại. Lưu file để Vite tự cập nhật trang.

## Lệnh thường dùng

| Lệnh                   | Công dụng                                         |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Server phát triển, cổng 5173                      |
| `npm run typecheck`    | Kiểm tra kiểu TypeScript ở chế độ strict          |
| `npm run lint`         | Kiểm tra ESLint và quy tắc React Hooks            |
| `npm run format`       | Định dạng code bằng Prettier                      |
| `npm run format:check` | Kiểm tra định dạng                                |
| `npm run check`        | Chạy typecheck, lint, kiểm tra định dạng và build |
| `npm run build`        | Tạo bản production trong `dist/`                  |
| `npm run preview`      | Xem bản build tại cổng 4173                       |

## Bắt đầu sửa ở đâu?

- `src/App.tsx`: component gốc.
- `src/App.css`: CSS cho component gốc.
- `src/index.css`: CSS toàn cục.
- `public/`: tài nguyên tĩnh.
- `.env.example`: mẫu biến môi trường, sao chép thành `.env.local`.

Chỉ dùng tiền tố `VITE_` cho dữ liệu công khai; giá trị này sẽ có trong mã gửi tới trình duyệt. Secret phải nằm ở backend. Các file `.env*` thực tế đã được bỏ qua bởi Git.

VS Code có danh sách extension được đề xuất: ESLint và Prettier. Cài chúng để tự định dạng và sửa lỗi lint khi lưu. Cấu hình dùng TypeScript của dự án.

## Quy trình làm việc

1. Chạy `npm run dev` và sửa code.
2. Chạy `npm run format` khi cần chuẩn hóa định dạng.
3. Chạy `npm run check` trước khi commit.

Starter chưa cấu hình backend, database hay bộ test tự động. Thêm các phần này khi tính năng cần đến.

`.npmrc` dùng cache tại `/workspace/.npm-cache` vì thư mục home trong môi trường Cloud bị giới hạn ghi. Khi chuyển ra máy cá nhân, có thể xóa dòng `cache` để npm dùng cache mặc định. Khi tái tạo môi trường, dùng Node 24 và `npm ci` để cài lại đúng dependency.
