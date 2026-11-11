# Nhật ký phần việc ngoài plan

Ghi nối tiếp theo từng tác vụ. Phân biệt việc đã thực hiện, đề xuất chưa làm và kết quả kiểm tra thực tế. Không ghi dữ liệu bí mật.

## 2026-11-12 — Tạo quy định và tài liệu bàn giao

### Plan ban đầu

Tạo `AGENTS.md` để agent nhận quy định; tạo `handoff.md` bàn giao trạng thái; tạo `worked.md` báo cáo đầy đủ việc ngoài plan. Ưu tiên sửa tối thiểu, không tự refactor và tiết kiệm usage/credits.

### Kết quả trong plan

- Đã tạo đúng ba file tài liệu tại `/workspace/web-starter`.
- Quy định rõ điều kiện build, trường hợp không test, giới hạn refactor/dependency và phạm vi kiểm tra tối thiểu.
- Đã ghi trạng thái dự án và cách tiếp tục vào `handoff.md`.
- Dùng tên chuẩn `AGENTS.md` như đã nêu trước khi thực hiện.

### Phần ngoài plan

Không có. Không sửa code ứng dụng, cài dependency, refactor, khởi động server hoặc chạy build/test trong tác vụ này.

### Kiểm tra và giới hạn

Đọc lại ba file và kiểm tra sự tồn tại. Không chạy `npm run check`, test hoặc build vì thay đổi chỉ ở Markdown. Nhật ký này bắt đầu từ tác vụ hiện tại; không có đủ plan gốc để phân loại hồi tố toàn bộ bước setup trước đó là trong/ngoài plan.

---

## Mẫu cho tác vụ tiếp theo

Khi có tác vụ mới, thêm mục với các thông tin sau; không ghi đè mục cũ:

- **Ngày và tác vụ:**
- **Plan ban đầu:** mục tiêu, phạm vi, kiểm tra dự kiến.
- **Kết quả trong plan:** phần đã hoàn thành.
- **Phần ngoài plan:** ghi từng phần; nếu không có, ghi “Không có”.
- **Lý do phát sinh và căn cứ thực hiện:** yêu cầu người dùng hoặc sự cần thiết với mục tiêu; dẫn chỉ dẫn liên quan nếu có.
- **Tác động thực tế:** file thay đổi, lệnh đáng kể đã chạy, dependency/cấu hình/dữ liệu bị tác động.
- **Kết quả:** hoàn thành, thất bại, còn dở hoặc đề xuất chưa thực hiện.
- **Kiểm tra:** lệnh/kết quả thực tế; phần không chạy và lý do.
- **Rủi ro và hoàn tác:** cách quay lại nếu có; không ghi đè thay đổi của người dùng.
- **Việc còn lại:** bước tiếp theo hoặc blocker cụ thể.
