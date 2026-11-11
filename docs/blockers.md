# Blockers và quyết định đang chờ

## P00

Không còn blocker triển khai P00. Stack đã được chủ dự án chốt Next.js + pnpm; repo GitHub đã nối, lịch sử được giữ nguyên. Local, clone sạch và CI run 43074691952 đều đạt cổng P00. PR #1 đang draft và chưa merge; không tự merge hoặc deploy.

Repo GitHub ban đầu chỉ có một commit README thay vì rỗng hoàn toàn; starter Vite và lịch sử remote đã được bảo toàn. Mọi điều chỉnh được ghi trong `worked.md`.

## P01 hiện tại

| ID            | Điều còn thiếu                                                            | Ảnh hưởng                   | Cách gỡ                                                                                                                                    |
| ------------- | ------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| MCP-CLOUD     | Không có tool NotebookLM hoặc server MCP trong executor hiện tại          | P01-T01 live verification   | Dùng kết nối hiện có ở nơi nó callable, hoặc cấu hình MCP cho chat Cloud; chỉ cần tên/transport/version để kiểm metadata, không gửi secret |
| MCP-3DAYS     | Chưa có observation thật                                                  | Cổng P01-T01                | Chạy năm chủ đề cùng nguồn trên ít nhất ba ngày khác nhau; runbook/validator đã sẵn sàng                                                   |
| HOSTING-Q5    | Câu trả lời mới chọn Pro cho AI, chưa có ngân sách/lựa chọn hosting       | P01-T03 và ADR-0006         | Hồ sơ ADR-0009 đã chuẩn bị; chờ lựa chọn local/preview free/paid có trần                                                                   |
| OPENAI-ACCESS | Chưa có entitlement/credit grant/OAuth token được cấp cho app trong Cloud | P01-T04 xác minh model thật | Chọn luồng hỗ trợ chính thức theo ADR-0010; cấu hình qua settings, không gửi token/key trong chat                                          |

Q1 phần cho phép MCP bên thứ ba đã xác nhận, tài khoản cá nhân. Người dùng nói đã nối NotebookLM, nhưng điều đó chưa tạo tool callable trong chat Cloud này. Không coi dữ liệu unit test hoặc reference benchmark là bằng chứng đã truy cập account.

## Các phase sau P01 (chưa triển khai)

| ID          | Thông tin cần có                                                | Chặn                                                               | Trạng thái     |
| ----------- | --------------------------------------------------------------- | ------------------------------------------------------------------ | -------------- |
| APPROVAL-01 | Tiếp tục theo từng phase và quyết định nghiệp vụ tương ứng      | P01 đã được cho phép bằng lệnh tiếp tục; phase sau chưa triển khai | P01 AUTHORIZED |
| Q1          | MCP bên thứ ba đã cho phép; còn xác minh server/nguồn thực tế   | P01-T01 live, P06                                                  | PARTIAL        |
| Q2          | Cấu trúc đề, đề cương, đề cũ, quy tắc chấm và danh pháp         | P05, P07, P08, P10                                                 | OPEN           |
| Q3          | Một người, cả lớp hay công khai                                 | P03                                                                | OPEN           |
| Q5          | Ngân sách hosting/AI và nhà cung cấp LLM ưu tiên                | P01, P06, P12                                                      | OPEN           |
| Q6          | Luồng sinh/duyệt, chính sách nguồn web và giấy phép hình        | P06                                                                | OPEN           |
| D-01        | PostgreSQL lưu ngân hàng câu hỏi, NotebookLM là nguồn kiến thức | Phase dữ liệu tương ứng                                            | PROPOSED       |
| ASSET-01    | Hình giải phẫu có nguồn và giấy phép rõ ràng                    | P09                                                                | OPEN           |

Q4 mặc định A-03 (responsive, online); Q7 hạn thi/MVP chưa chặn. Không tự quyết thay chủ dự án; không yêu cầu secret qua chat.
