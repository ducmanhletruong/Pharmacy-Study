# P04 — nhập và duyệt nội dung local

Chỉ dùng bundle có quyền sử dụng phù hợp với người nhận. Quyền dùng giáo trình cá nhân đã xác nhận ở P01 không tự mở rộng thành quyền chia sẻ cho lớp. Fixture `content/fixtures/p04-bundle.json` hoàn toàn tổng hợp. Không có pipeline sinh AI trong P04.

## Chuẩn bị và import

Chạy migrate bằng maintenance credential, seed nếu cần, rồi chạy web bằng login app_rw đã provision. Không đưa maintenance credential vào runtime web. Hướng dẫn đăng nhập ở [Google login](google-login.md); provider test của CI không chứng minh Google OAuth thật.

```sh
pnpm db:migrate
pnpm content:validate content/fixtures/p04-bundle.json
pnpm dev
```

Admin mở `/admin`, chọn file JSON rồi nhập. [Bundle profile](../bundle-format.md) mô tả các trường và alias. CLI kiểm cấu trúc/tham chiếu; server tiếp tục giải mã và kiểm bytes ảnh. API nhận JSON hoặc multipart field `bundle`; tên file không được dùng làm đường dẫn. Mặc định tổng request tối đa 5 MiB, `MAX_IMPORT_BYTES` server cho phép 1024–52428800 bytes; multipart overhead cũng tính vào giới hạn. Body thông thường vẫn dùng `MAX_BODY_BYTES`. Quá giới hạn trả 413; learner gọi import trả 403.

Import chạy trong một transaction: lỗi giữa chừng rollback cả topic, nguồn, asset, câu và bản ghi import. Cùng bundle đã chuẩn hóa trả `already_imported`; thay thứ tự mảng có thể tạo import mới nhưng hash nội dung câu vẫn chống trùng chính xác trong cùng môn. Các cảnh báo pg_trgm chỉ là gợi ý xem xét, không tự gộp/xóa câu gần giống. Import mới tạo draft; nguồn mới pending. Nguồn có fingerprint trùng trong cùng môn được tái sử dụng, gồm trạng thái review đã có. Subject mới dùng manifest.label làm tên; subject đã tồn tại không bị đổi tên.

## Ảnh và quyền nguồn

Asset được lưu private trong PostgreSQL, không tải URL ngoài hoặc ghi file từ đường dẫn bundle. SVG chỉ cho phép tập hình học tĩnh; script/event/style/URL/DTD/foreignObject và cấu trúc XML không hợp lệ bị từ chối. PNG/JPEG/WebP phải đúng magic, giải mã được, một frame và giới hạn pixel; server reencode để bỏ metadata và hash bytes lưu thật. Tối đa 2 MiB/asset, 16 triệu pixel và 8192 pixel mỗi cạnh. Endpoint ảnh có auth, no-store, nosniff và CSP sandbox; learner chỉ đọc ảnh ở câu approved hoặc revision trong bài của chính mình.

SHA ảnh là duy nhất toàn cục. Cùng bytes nhưng khác license/attribution/alt/source bị từ chối 409 để không âm thầm thay provenance. Sửa metadata ảnh cần tạo asset có bytes khác hoặc quy trình migration được review; không sửa SQL trực tiếp để vượt gate.

## Duyệt, sửa và báo lỗi

Kiểm nguồn/giấy phép trước khi approve nguồn. Chọn câu, chuyển draft → verified → approved. Server và DB đều kiểm có nguồn approved, giấy phép và asset hợp lệ trước phát hành. Chỉ approved được chọn vào bài mới. Từ chối nguồn tự đưa các câu verified/approved đang tham chiếu về under_review.

PATCH câu phải có expected_version. 409 nghĩa dữ liệu đã thay đổi hoặc xung đột: tải lại chi tiết rồi xem lại toàn bộ thao tác. Sửa nội dung luôn tạo revision mới, trở về draft; không gộp sửa với approve. Bài cũ giữ revision và nguồn đã chụp. Không sửa revision sealed hoặc bỏ trigger để sửa lịch sử.

Người học chỉ báo lỗi câu từng có trong bài của chính mình. Báo lỗi tự quarantine; hidden/retired giữ nguyên. Báo lỗi mở trùng của cùng người/câu được tái sử dụng. Admin xử lý báo lỗi không tự approve lại câu; cần review rồi chuyển trạng thái rõ ràng. `retired` không được mở lại bằng status PATCH.

## Thu hồi một import và phục hồi

Ghi lại import_id từ kết quả hoặc GET `/api/v1/admin/imports/{id}`. Không xóa import/history hay down migration. Với import đã phát hành, maintenance operator có thể dùng transaction sau, thay UUID bằng ID đã kiểm tra:

```sql
BEGIN;
SELECT q.id, q.status
FROM questions q WHERE q.import_id = '<reviewed-import-uuid>'::uuid
FOR UPDATE;
UPDATE questions
SET status = 'under_review', version = version + 1, updated_at = now()
WHERE import_id = '<reviewed-import-uuid>'::uuid
  AND status IN ('verified', 'approved');
COMMIT;
```

Đây là thao tác vận hành có review, chưa có nút thu hồi hàng loạt. Draft vẫn không phát hành; hidden/retired không đổi. Câu dedup được import khác tái sử dụng không thuộc import_id mới, không bị thu hồi nhầm. Review trước/sau và lưu audit vận hành riêng; không xóa audit_logs. Lỗi 40001/40P01 cần retry toàn transaction sau khi đọc lại. Thay schema dùng forward migration, không chỉnh checksum 0007 đã áp.
