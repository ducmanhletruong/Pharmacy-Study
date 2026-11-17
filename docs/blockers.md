# Blockers và quyết định đang chờ

Cập nhật 2026-11-17 (Asia/Saigon).

## P02 hiện tại

Code hoàn thành local; chờ CI để đạt cổng phase. Không còn blocker NotebookLM ba ngày: Windows đã đủ 15 observation, owner đã duyệt grounding và điều khoản. Không yêu cầu đăng nhập lại hoặc chạy thêm ngày. API AI và hosting production không phải tiên quyết của luồng luyện tổng hợp P02.

## Các phase sau (chưa thực hiện)

| ID                 | Thông tin / kiểm chứng còn thiếu                                                                               | Phạm vi         |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | --------------- |
| Q3                 | Chỉ cá nhân, cả lớp hay công khai; provider đăng nhập thật                                                     | P03             |
| Q2                 | Cấu trúc đề, đề cương, danh pháp, quy tắc chấm                                                                 | P05/P07/P08/P10 |
| OPENAI-ACCESS      | Credential/luồng OAuth hỗ trợ chính thức, model, hạn mức, kiểm batch thật; chọn OpenAI không tự cấp API từ Pro | P06             |
| Q6                 | Luồng sinh/duyệt, nguồn web, quyền hình ảnh                                                                    | P06             |
| ASSET-01           | Nguồn và quyền ảnh giải phẫu                                                                                   | P09             |
| HOSTING-PRODUCTION | Provider/budget, RPO/RTO và cấu hình phát hành                                                                 | P12             |

Q1 đã xác nhận MCP bên thứ ba và quyền dùng nguồn cá nhân, không công khai giáo trình; P01 live gate đã được chủ dự án duyệt. Q4 dùng mặc định responsive/online. Không dùng mock/provider thay thế âm thầm, không yêu cầu key/token trong chat.

## Bảo toàn dữ liệu

Capture/nguồn/credential giữ ở Windows private bị ignore; không nhập vào repo hoặc DB seed. Chỉnh sửa public chưa push ở Windows chưa được hợp nhất vào Cloud; không reset/pull ghi đè chúng. Cloud mới clone phase-01 trước khi tạo branch phase-02; PostgreSQL local mới chỉ chứa dữ liệu tổng hợp.
