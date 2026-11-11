# Blockers và quyết định đang chờ

## P00

Không có quyết định sản phẩm OPEN chặn chuẩn bị P00. Stack đã được người dùng chốt Next.js + pnpm; repo GitHub đã được cung cấp và kiểm tra quyền truy cập. CI, clean clone và PostgreSQL healthcheck đang chờ kiểm chứng, chưa coi là đạt.

Repo GitHub có một commit README thay vì rỗng hoàn toàn. Đã bảo toàn lịch sử remote và starter local, giải quyết xung đột README chỉ có tên repo; ghi chi tiết vào `worked.md`.

## Các phase sau (chưa triển khai)

| ID          | Thông tin cần có                                                      | Chặn                    | Trạng thái |
| ----------- | --------------------------------------------------------------------- | ----------------------- | ---------- |
| APPROVAL-01 | Duyệt chính thức PRD v0.1 và implementation plan                      | Mọi phase sau P00       | OPEN       |
| Q1          | Cho dùng MCP NotebookLM bên thứ ba và xác nhận quyền sử dụng tài liệu | P01, P06                | OPEN       |
| Q2          | Cấu trúc đề, đề cương, đề cũ, quy tắc chấm và danh pháp               | P05, P07, P08, P10      | OPEN       |
| Q3          | Một người, cả lớp hay công khai                                       | P03                     | OPEN       |
| Q5          | Ngân sách hosting/AI và nhà cung cấp LLM ưu tiên                      | P01, P06, P12           | OPEN       |
| Q6          | Luồng sinh/duyệt, chính sách nguồn web và giấy phép hình              | P06                     | OPEN       |
| D-01        | PostgreSQL lưu ngân hàng câu hỏi, NotebookLM là nguồn kiến thức       | Phase dữ liệu tương ứng | PROPOSED   |
| ASSET-01    | Hình giải phẫu có nguồn và giấy phép rõ ràng                          | P09                     | OPEN       |

Q4 mặc định A-03 (responsive, online); Q7 hạn thi/MVP chưa chặn. Không tự quyết thay chủ dự án; không yêu cầu secret qua chat.
