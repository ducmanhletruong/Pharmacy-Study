# ADR-0007 — Nhà cung cấp LLM

- Trạng thái: Accepted cho nhà cung cấp OpenAI; cách cấp quyền tích hợp còn OPEN ở P06.
- Cập nhật: 2026-11-17 (Asia/Saigon).
- Căn cứ: chủ dự án đã chọn dùng OpenAI/ChatGPT Pro của tài khoản hiện có.

## Quyết định

Chọn OpenAI. Không tự đổi provider, tạo billing hoặc suy ra thuê bao Pro đã cấp API credential cho website. ADR-0010 giữ các phương án cấp quyền để xác minh trước P06. Model, hạn mức và chi phí thực tế chưa được chọn; không tự dùng model trả phí.

## Bằng chứng và giới hạn

P01 có bộ đánh giá nhỏ với năm output tổng hợp, report codex-session-report.json: 5/5 đạt kiểm tra cơ học, không mù, không chứng minh chất lượng chuyên môn hoặc quyền API. Đây là hồ sơ quyết định/spike; tích hợp API thuộc P06, không phải điều kiện khởi động luồng luyện tổng hợp P02.

## Khi thất bại

Dừng sinh câu khi thiếu quyền/hạn mức; giữ nội dung đã duyệt và phương thức có người thao tác. Không âm thầm chuyển provider. Cần kiểm model định danh, nguồn và đường cấp quyền trước khi thực hiện adapter P06.
