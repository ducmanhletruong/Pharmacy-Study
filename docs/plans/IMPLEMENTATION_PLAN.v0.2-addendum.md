# Implementation plan — phụ lục v0.2, CR-0001

Ngày2026-11-18. Bổ sung plan v0.1 gốc (giữ nguyên theo AGENTS). Phạm vi được chủ dự án giao: CR-0001, không P04 mới.

- P02 integrity: migration0003 forward-only, MCQ đủ4 lựa chọn khác nhau/1đúng, seal revision theo trạng thái/current revision/attempt reference, composite FK topic cùng môn; query readAttempt gộp choices; config pool/payload/DEV_HOST.
- P03 hiện có được giữ; production phải có APP_ORIGIN rõ ràng, session thật và rate limit đã có; không suy ra Origin từ Host trong production.
- P04-T03: chuyển draft→verified→approved qua một dịch vụ duy nhất, kiểm nguồn và ghi người duyệt; chỉ seed tổng hợp được tự approved. Ghi revision +4choices trong cùng transaction, sửa sealed tạo revision mới.
- P05: trước thống kê chủ đề yếu cần chốt by_topic nhiều chủ đề; CR không thay hành vi hiện tại tính vào mỗi topic.
- P12: startup production từ chối credential local-dev-only hoặc DB host127.0.0.1 theo CR; chưa thực hiện trong lượt này.
- Xem lại ORDER BY random khi >2.000 approved/môn hoặc p95 tạo đề>100ms. Theo dõi minimatch moderate mỗi phase, không nâng toolchain ngoài phạm vi.
- Cổng: DB rỗng/upgrade đã seed/rerun, reverse tests trước migration, integrity/API/query-count tests, E2E/build/CI. Không merge/deploy; Google live P03 vẫn chờ cấu hình riêng.
