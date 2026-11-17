# ADR-0012 — Ràng buộc MCQ và niêm phong revision ở DB

Accepted theo yêu cầu thực hiện CR-0001 ngày2026-11-18; bổ sung ADR-0005.

Deferred constraint triggers bắt đủ4 lựa chọn khác nhau lower(btrim(text)), đúng1đáp án; app vẫn kiểm NFC/locale chặt hơn. Revision/choices không sửa/xóa nếu có attempt tham chiếu, question không draft hoặc revision đã được thay thế. Draft hiện hành chưa dùng còn sửa được. INSERT choices không bị guard để seed ON CONFLICT chạy lại; PK A/B/C/D và deferred validation bảo vệ đủ4. Composite FK ép question/topic cùng subject.

Rủi ro cao nhất là luồng ghi phải gom revision+choices trong transaction; migration kiểm toàn bộ data cũ và rollback nếu sai, không tự sửa data. Seed chỉ là tổng hợp. Không triển khai workflow duyệt P04. DB owner vẫn có quyền quản trị/DDL; seal không chống DBA hoặc DISABLE TRIGGER. Runtime app_rw không có các quyền đó.

CR soạn trước P03 nên dùng0003 thay0002, base phase-03 thayphase-02. Không sửa migration đã chạy. Tests chạy maintenance transaction rollback, không tắt trigger. Query gộp giữ strict contract/redaction; config mới validate integer/caps, local bind127.0.0.1 mặc định. APP_ORIGIN production bắt buộc.

Kiểm chứng/tiến độ duy nhất ở ../status.md. Rollback production phải backup và dùng forward migration được review; không xóa _migrations/hash hoặc chạy rollback thủ công trong CR trên data thật. Revert code phải khớp schema mới có subject_id NOT NULL. Giữ PR draft, by_topic decision và Google live còn mở.
