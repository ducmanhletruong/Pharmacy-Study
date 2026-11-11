# Blockers và quyết định đang chờ

## P00

Không còn blocker triển khai P00. Stack đã được chủ dự án chốt Next.js + pnpm; repo GitHub đã nối, lịch sử được giữ nguyên. Local, clone sạch và CI run 43074691952 đều đạt cổng P00. PR #1 đang draft và chưa merge; không tự merge hoặc deploy.

Repo GitHub ban đầu chỉ có một commit README thay vì rỗng hoàn toàn; starter Vite và lịch sử remote đã được bảo toàn. Mọi điều chỉnh được ghi trong `worked.md`.

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
