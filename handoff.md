# Bàn giao

Cập nhật: 2026-11-18 (Asia/Saigon). Worktree `/workspace/pharmacy-study-p03`, branch `phase-03`, base `phase-02`.

## Yêu cầu và kết quả

Theo yêu cầu nêu và thực hiện bước tiếp theo, triển khai P03 cho **lớp được mời, Google** (Q3 đã xác nhận). P00–P02 DONE; P01 đủ 15 observation/ba ngày và owner đã duyệt, không yêu cầu chạy lại. P03 có code T01–T06 nhưng chưa DONE vì Google OAuth thật chưa cấu hình/kiểm; CI đang chuẩn bị. Không bắt đầu P04.

## Thay đổi

- Google OIDC/NextAuth stable, email verified + exact admin/invited allowlist; cookie JWT8h gắn DB session revoke/expiry/disabled, không lưu OAuth access/refresh token. Test provider chỉ nonproduction.
- Authorize default deny, guard mọi route attempt và SQL user_id; admin không đọc attempt người khác. Admin API/page riêng, no-store, request ID.
- Migration0002, auth identities/sessions, audit_logs append-only, rate counters; nhóm DB app_rw/migrator riêng. Helper provision local ghi credential sinh ngẫu nhiên vào file private, không in ra.
- Origin/Host, body limit16KB, CSP nonce/security headers, rate limit PostgreSQL; launcher từ chối runtime credential đặc quyền và dev/test production.
- Tests auth/ownership/audit/rate/header, CI phase-03. Patch hai bản picomatch dev để chặn advisory high chưa có upstream fix; chi tiết docs/security/dependency-hardening.md. Không nâng nền hoặc refactor phần ngoài P03.

## Kiểm tra thực tế

Local unit104/104, integration14/14, E2E Chromium8/8 (bao gồm luồng10câu/mobile cũ và login/logout/cross-user mới) đã đạt. Production build, guard dev/test, migration/seed rerun và runtime DB ít quyền đã đạt. E2E dùng provider thử, **chưa kiểm Google thật**. Audit raw high1/moderate1, high đã có patch/regression; kiểm cuối lint/format/audit/CI ghi thêm khi hoàn tất.

## Bước còn lại

1. Cấu hình Google OAuth Web client riêng và email thật trong `.env` private theo [runbook](docs/runbooks/google-login.md). Không gửi secret trong chat. Kiểm Google admin/member/outsider/logout rồi ghi bằng chứng, mới đóng cổng P03.
2. CI và PR draft phase-03 base phase-02; không merge/deploy. Quản lý user UI ngoài phạm vi. P04 chờ giao sau cổng P03.
3. API entitlement/model/billing OpenAI ở P06; gói Pro không tự cấp API credit. Hosting production vẫn hoãn. Quyền nguồn P01 chỉ cá nhân, chưa cho phân phối giáo trình cho lớp.

## Chạy và bảo toàn

Xem docs/runbooks/google-login.md. P03 dùng DB `pharmacy_study_p03` riêng; `.env` runtime app ít quyền, `.env.db` CLI maintenance (đều ignore/600). Không copy `.env.db` vào web/hosting. P02 checkout `/workspace/web-starter`, DB cũ và dev server3000 được giữ; auth E2E dùng3001. Không overwrite clone Windows chứa capture/cookie private. Không xóa Docker volume hoặc sửa SQL migration đã áp dụng; thay đổi schema sau bằng forward migration. Worked.md ghi đầy đủ phát sinh và lỗi kiểm chứng.
