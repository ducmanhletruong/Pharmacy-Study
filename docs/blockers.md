# Blockers và quyết định đang chờ

## P00

Không còn blocker triển khai P00. Stack đã được chủ dự án chốt Next.js + pnpm; repo GitHub đã nối, lịch sử được giữ nguyên. Local, clone sạch và CI run 43074691952 đều đạt cổng P00. PR #1 đang draft và chưa merge; không tự merge hoặc deploy.

Repo GitHub ban đầu chỉ có một commit README thay vì rỗng hoàn toàn; starter Vite và lịch sử remote đã được bảo toàn. Mọi điều chỉnh được ghi trong `worked.md`.

## P01 hiện tại

| ID               | Điều còn thiếu                                                              | Ảnh hưởng                   | Cách gỡ                                                                                           |
| ---------------- | --------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| MCP-CLOUD-ACCESS | Cloud chưa xác thực; Windows list thành công theo chủ dự án (47 notebook)   | Chỉ gọi trực tiếp từ Cloud  | Tiếp tục kiểm chứng P01 bằng tay tại Windows; không cần đăng nhập Cloud lại                       |
| MCP-3DAYS        | Chưa có observation kiến thức/citation thật; quyền dùng cá nhân đã xác nhận | Cổng P01-T01                | Chạy tại Windows theo docs/spikes/notebooklm-windows-handoff.md; recorder/validator đã có         |
| OPENAI-ACCESS    | Chưa có entitlement/credit grant/OAuth token được cấp cho app trong Cloud   | P01-T04 xác minh model thật | Chọn luồng hỗ trợ chính thức theo ADR-0010; cấu hình qua settings, không gửi token/key trong chat |

Q1 phần cho phép MCP bên thứ ba đã xác nhận, tài khoản cá nhân. Người dùng nói đã nối NotebookLM, nhưng điều đó chưa tạo tool callable trong chat Cloud này. Không coi dữ liệu unit test hoặc reference benchmark là bằng chứng đã truy cập account.

### Cập nhật Windows — 2026-11-12

Chủ dự án cung cấp kết quả notebook_list thành công trên Windows, tài khoản có 47 notebook, chỉ đọc; đã đối chiếu lịch sử call chat local. Quyền dùng nguồn năm notebook cho học tập cá nhân, không công khai giáo trình, đã xác nhận trực tiếp. Còn thiếu kiến thức/citation và ba ngày. Các mô tả Cloud timeout dưới đây là lịch sử riêng của Cloud, không yêu cầu đăng nhập lặp lại. Cloud không phải điều kiện bắt buộc cho kiểm chứng bằng tay P01-T01. Tiếp tục theo handoff Windows; chưa tự chạy hoặc gửi việc sang agent local.

## Các phase sau P01 (chưa triển khai)

| ID          | Thông tin cần có                                                                        | Chặn                                                               | Trạng thái                            |
| ----------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------- |
| APPROVAL-01 | Tiếp tục theo từng phase và quyết định nghiệp vụ tương ứng                              | P01 đã được cho phép bằng lệnh tiếp tục; phase sau chưa triển khai | P01 AUTHORIZED                        |
| Q1          | MCP bên thứ ba và quyền dùng nguồn cá nhân đã xác nhận; còn kiểm chứng citation/ba ngày | P01-T01 live, P06                                                  | DECISION CONFIRMED / EVIDENCE PENDING |
| Q2          | Cấu trúc đề, đề cương, đề cũ, quy tắc chấm và danh pháp                                 | P05, P07, P08, P10                                                 | OPEN                                  |
| Q3          | Một người, cả lớp hay công khai                                                         | P03                                                                | OPEN                                  |
| Q5          | Ngân sách hosting/AI và nhà cung cấp LLM ưu tiên                                        | P01, P06, P12                                                      | OPEN                                  |
| Q6          | Luồng sinh/duyệt, chính sách nguồn web và giấy phép hình                                | P06                                                                | OPEN                                  |
| D-01        | PostgreSQL lưu ngân hàng câu hỏi, NotebookLM là nguồn kiến thức                         | Phase dữ liệu tương ứng                                            | PROPOSED                              |
| ASSET-01    | Hình giải phẫu có nguồn và giấy phép rõ ràng                                            | P09                                                                | OPEN                                  |

Q4 mặc định A-03 (responsive, online); Q7 hạn thi/MVP chưa chặn. Không tự quyết thay chủ dự án; không yêu cầu secret qua chat.

## Đã giải quyết trong P01

- HOSTING-Q5 cho giai đoạn hiện tại: chủ dự án đã chọn tiếp tục local, chưa production; ADR-0011 Accepted. Không cần chọn paid/preview hosting ở thời điểm này. Quyết định provider/budget production vẫn hoãn, chỉ cần xử lý khi chuẩn bị triển khai theo phạm vi mới.
- Nhà cung cấp AI đã chọn OpenAI/ChatGPT Pro; còn đường cấp quyền/hạn mức, không còn câu hỏi chọn provider thay thế.

### Trạng thái kết nối mới

Snapshot “0 server” phía trên chỉ mô tả trước khi cấu hình. Hiện Codex CLI của Cloud đã có pharmacy-notebooklm, stdio đã initialize và list 55 tool thành công; chỉ bật hai tool đọc. Blocker hiện tại là đăng nhập Google, không còn thiếu cài đặt MCP. Phiên login thử timeout sau 300 giây, chưa đọc được notebook. Tích hợp native vào tool inventory của chat đang chạy chưa được xác minh.
