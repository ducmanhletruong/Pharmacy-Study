# ADR-0008 — Google OIDC cho lớp được mời

- Trạng thái: Accepted về phạm vi/provider; Google live verification còn chờ cấu hình.
- Cập nhật: 2026-11-18 (Asia/Saigon).
- Nguồn: IMPLEMENTATION_PLAN.md mục 4.1 và câu trả lời Q3 trực tiếp của chủ dự án.

## Quyết định

Chủ dự án chọn “Một nhóm/lớp được mời” và Google. Dùng Auth.js/NextAuth stable 4.24.15, ADMIN_EMAILS và INVITED_EMAILS exact match, email Google đã xác minh; vai trò admin/learner, không đăng ký tự do hoặc UI quản lý user. Không dùng phiên MCP NotebookLM làm phiên website.

## Hệ quả

JWT cookie HttpOnly gắn session DB tối đa 8 giờ, revoke khi logout; authorize tập trung kết hợp SQL owner filter. Admin không mặc nhiên đọc attempt của học viên. Không lưu OAuth access/refresh token. Test provider chỉ ngoài production, dev/test đều bị chặn ở production. Dùng stable release có compatibility Next16/React19 thay vì beta không cần thiết.

Đăng nhập Google thật cần OAuth Web client và danh sách email được cấu hình riêng theo docs/runbooks/google-login.md. CI/E2E provider thử không chứng minh callback Google thật hoạt động. Quyết định này không duyệt hosting production hoặc mở quyền phân phối giáo trình cho cả lớp; phạm vi nguồn P01 vẫn chỉ cá nhân, không công khai giáo trình.
