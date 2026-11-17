# Blockers và quyết định đang chờ

## Cập nhật 2026-11-17 — cổng P01

Windows đã có 15 observation đủ năm chủ đề trên ba ngày 12/11, 13/11, 17/11; recorder/validator exit 0 theo báo cáo cuối của chat local và xác nhận chủ dự án. Hai mục pending cũ đã được bổ sung ở Windows; không còn là blocker hiện tại. Chủ dự án đã tự review và duyệt grounding/vị trí nguồn cùng điều khoản ngày 17/11. Cloud đối chiếu báo cáo/lịch sử, không tải nguồn hoặc capture private.

P01-T01 DONE; P01 kết thúc trong phạm vi spike/local. ADR-0006 áp dụng quyết định local đã duyệt, ADR-0007 ghi lựa chọn OpenAI đã xác nhận. API credential/model/chi phí và hosting production vẫn mở cho phase tích hợp/phát hành; không tự tạo điều kiện API hoạt động để chặn P02. Các đoạn ngày 12/11 bên dưới là lịch sử, được cập nhật này thay thế về trạng thái.

Chủ dự án yêu cầu tiếp tục bước tiếp theo: P02 là phase thực thi kế tiếp, chỉ dữ liệu tổng hợp và user dev, không AI runtime hoặc nguồn giáo trình. Không merge PR/deploy. Môi trường Cloud vừa khôi phục không còn checkout/runtime cũ; đã clone đúng branch phase-01 vào /workspace/web-starter, không tác động Windows.

## P00

Không còn blocker triển khai P00. Stack đã được chủ dự án chốt Next.js + pnpm; repo GitHub đã nối, lịch sử được giữ nguyên. Local, clone sạch và CI run 43074691952 đều đạt cổng P00. PR #1 đang draft và chưa merge; không tự merge hoặc deploy.

Repo GitHub ban đầu chỉ có một commit README thay vì rỗng hoàn toàn; starter Vite và lịch sử remote đã được bảo toàn. Mọi điều chỉnh được ghi trong `worked.md`.

## P01 hiện tại

| ID               | Điều còn thiếu                                                                 | Ảnh hưởng                   | Cách gỡ                                                                                                           |
| ---------------- | ------------------------------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| MCP-CLOUD-ACCESS | Cloud chưa xác thực; Windows list thành công theo chủ dự án (47 notebook)      | Chỉ gọi trực tiếp từ Cloud  | Tiếp tục kiểm chứng P01 bằng tay tại Windows; không cần đăng nhập Cloud lại                                       |
| MCP-CITATION-2   | Hóa phân tích và Giải phẫu sinh lý thiếu citation metadata ở lượt đầu          | P01-T01 đủ năm chủ đề       | Kiểm citations/references của output private đã lưu; chưa đủ thì giữ pending, không tự gán nguồn                  |
| MCP-ADMIN-REVIEW | Ba observation và việc đọc điều khoản do agent đối chiếu; chưa có admin review | Cổng P01-T01                | Admin kiểm nguồn/vị trí/trích đoạn và hồ sơ điều khoản trên Windows; ghi kết luận thực tế, không tự xác nhận thay |
| MCP-3DAYS        | Đã lưu 3 observation, validator exit 2; hiện 0/3 ngày đủ cả năm chủ đề         | Cổng P01-T01                | Giữ cùng năm chủ đề, thu đủ các ngày thật; không đổi timestamp hoặc nhập lại ba mục đã có                         |
| OPENAI-ACCESS    | Chưa có entitlement/credit grant/OAuth token được cấp cho app trong Cloud      | P01-T04 xác minh model thật | Chọn luồng hỗ trợ chính thức theo ADR-0010; cấu hình qua settings, không gửi token/key trong chat                 |

Q1 phần cho phép MCP bên thứ ba đã xác nhận, tài khoản cá nhân. Người dùng nói đã nối NotebookLM, nhưng điều đó chưa tạo tool callable trong chat Cloud này. Không coi dữ liệu unit test hoặc reference benchmark là bằng chứng đã truy cập account.

### Cập nhật Windows — 2026-11-12

Windows đã chạy lượt kiến thức đầu tiên: 5/5 query thành công, 3 observation có citation/vị trí/trích đoạn được agent đối chiếu, 2 chủ đề còn pending metadata. Đã đối chiếu lịch sử chat local có năm notebook_query hoàn thành; chưa đọc capture private từ Cloud. Quyền dùng nguồn năm notebook cho học tập cá nhân đã xác nhận; admin review kết quả/điều khoản và bằng chứng ba ngày vẫn thiếu. Cloud không phải điều kiện bắt buộc của kiểm chứng này; không yêu cầu đăng nhập lại. Handoff có hướng kiểm tra riêng hai chủ đề pending, không retry cả batch hoặc đổi topic để né lỗi.

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
- Đã có năm output Codex trong chat đạt evaluator trên fixture tổng hợp (5/5), không gọi API và không xác minh model/version, entitlement hoặc chuyên môn. Kết quả này không gỡ OPENAI-ACCESS.

### Trạng thái kết nối mới

Snapshot “0 server” phía trên chỉ mô tả trước khi cấu hình. Hiện Codex CLI của Cloud đã có pharmacy-notebooklm, stdio đã initialize và list 55 tool thành công; chỉ bật hai tool đọc. Blocker hiện tại là đăng nhập Google, không còn thiếu cài đặt MCP. Phiên login thử timeout sau 300 giây, chưa đọc được notebook. Tích hợp native vào tool inventory của chat đang chạy chưa được xác minh.
