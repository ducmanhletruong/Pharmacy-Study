# Blockers và quyết định đang chờ

Cập nhật 2026-11-18 (Asia/Saigon).

## P02 hiện tại

P02 DONE: code local và CI run 44133096057 đã đạt. Không còn blocker hiện hành của P02. Không còn blocker NotebookLM ba ngày: Windows đã đủ 15 observation, owner đã duyệt grounding và điều khoản. Không yêu cầu đăng nhập lại hoặc chạy thêm ngày. API AI và hosting production không phải tiên quyết của luồng luyện tổng hợp P02.

## Các phase sau (chưa thực hiện)

| ID                 | Thông tin / kiểm chứng còn thiếu                                                                               | Phạm vi         |
| ------------------ | -------------------------------------------------------------------------------------------------------------- | --------------- |
| GOOGLE-LIVE        | OAuth Web client + danh sách email cấu hình private, kiểm callback Google thật; Q3 đã chốt lớp được mời/Google | P03             |
| Q2                 | Cấu trúc đề, đề cương, danh pháp, quy tắc chấm                                                                 | P05/P07/P08/P10 |
| OPENAI-ACCESS      | Credential/luồng OAuth hỗ trợ chính thức, model, hạn mức, kiểm batch thật; chọn OpenAI không tự cấp API từ Pro | P06             |
| Q6                 | Luồng sinh/duyệt, nguồn web, quyền hình ảnh                                                                    | P06             |
| ASSET-01           | Nguồn và quyền ảnh giải phẫu                                                                                   | P09             |
| HOSTING-PRODUCTION | Provider/budget, RPO/RTO và cấu hình phát hành                                                                 | P12             |

Q1 đã xác nhận MCP bên thứ ba và quyền dùng nguồn cá nhân, không công khai giáo trình; P01 live gate đã được chủ dự án duyệt. Q4 dùng mặc định responsive/online. Không dùng mock/provider thay thế âm thầm, không yêu cầu key/token trong chat.

## Bảo toàn dữ liệu

Capture/nguồn/credential giữ ở Windows private bị ignore; không nhập vào repo hoặc DB seed. Chỉnh sửa public chưa push ở Windows chưa được hợp nhất vào Cloud; không reset/pull ghi đè chúng. Cloud mới clone phase-01 trước khi tạo branch phase-02; PostgreSQL local mới chỉ chứa dữ liệu tổng hợp.

## P03 hiện tại

Code và kiểm local bằng provider thử đã triển khai; không có Google client credentials ở Cloud. Owner cấu hình private theo docs/runbooks/google-login.md rồi kiểm admin/member/outsider/logout bằng Google thật. Không cần gửi secret qua chat. CI phase-03 run44165851119 đã SUCCESS; P03 chưa DONE, P04 chưa mở.

## CR-0001

Không còn blocker hardening CR; xem kết quả và cổng CI trong docs/status.md. Quy tắc by_topic nhiều chủ đề vẫn OPEN trướcP05, không tự chọn trong CR. Các đề xuất workflow duyệt/P12 password guard được đưa vào phụ lục plan0.2, không thực hiện ngoài scope. PRs giữ draft, không merge/deploy.

## Đợt2 phục hồi/bảo mật

Không còn blocker trong scope đợt2; kết quả và finding còn OPEN của đợt3 ở docs/status.md. Runbook recovery-security ghi giới hạn quota, stale-lock/journal recovery. Google live vẫn là cổng riêng, không yêu cầu thêm ngày P01.
