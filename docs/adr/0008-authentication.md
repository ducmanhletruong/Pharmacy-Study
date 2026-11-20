# ADR-0008 — Google OIDC và phiên ẩn danh

- Trạng thái: Accepted về phạm vi/provider; Google live verification còn chờ cấu hình.
- Cập nhật: 2026-11-19 (Asia/Saigon).
- Nguồn: IMPLEMENTATION_PLAN.md mục 4.1, Q3 và yêu cầu trực tiếp ngày19/11 bỏ whitelist, cho vào bằng Google hoặc ẩn danh.

## Quyết định

Chủ dự án cập nhật lựa chọn trước đây “Một nhóm/lớp được mời”: mọi email Google đã xác minh được vào học; ADMIN_EMAILS chỉ phân quyền admin, không làm allowlist vào website. INVITED_EMAILS không còn được dùng. Cho phép phiên ẩn danh với danh tính UUID riêng do server tạo, luôn learner; AUTH_MODE=guest dùng khi chưa có Google OAuth client. AUTH_MODE=oidc cho cả Google và guest. Tiếp tục dùng NextAuth stable4.24.15, không thêm thư viện auth hoặc UI quản lý user. Không dùng phiên MCP NotebookLM làm phiên website.

## Hệ quả

JWT cookie HttpOnly gắn session DB tối đa 8 giờ, revoke khi logout; authorize tập trung kết hợp SQL owner filter. Admin không mặc nhiên đọc attempt của học viên. Không lưu OAuth access/refresh token. Test provider chỉ ngoài production, dev/test đều bị chặn ở production. Dùng stable release có compatibility Next16/React19 thay vì beta không cần thiết.

Đăng nhập Google thật cần OAuth Web client và danh sách admin được cấu hình riêng theo docs/runbooks/google-login.md. CI/E2E provider thử không chứng minh callback Google thật hoạt động. Quyết định này không duyệt hosting production hoặc mở quyền phân phối giáo trình cho cả lớp; phạm vi nguồn P01 vẫn chỉ cá nhân, không công khai giáo trình.

Phiên ẩn danh dùng cùng CSRF/Origin/rate limit, session DB và cookie JWT tối đa8 giờ. Đăng xuất/mất cookie/hết phiên không phục hồi bài ẩn danh, không tự ghép vào Google; dữ liệu DB không tự xóa sau8 giờ. Người dùng bị disabled vẫn bị chặn. Đây là thay đổi phạm vi được user yêu cầu, không phải tự mở phase sản phẩm tiếp theo.
