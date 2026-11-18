# Lịch sử revision và topic — đợt3

Phạm vi: các finding RV-09/10/11/12/14/16 của review, không phải workflow import/duyệt P04. Trạng thái và kiểm chứng ở docs/status.md.

## Nâng cấp và giới hạn legacy

Dùng forward migration0005 qua maintenance credential, không sửa SQL đã áp. Migration sẽ từ chối cây topic cũ có chu trình, không tự sửa hoặc xóa topic để vượt kiểm. Sao lưu và kiểm dữ liệu trước khi áp lên DB có người dùng; lượt phát triển chỉ dùng DB thử riêng.

Seal mới lưu ledger: status quay về draft hoặc current pointer quay lại không mở được revision đã được ghi seal. Draft chưa dùng, chưa publish và chưa bị thay thế vẫn sửa được. Legacy chỉ backfill seal dựa trên bằng chứng hiện còn: trạng thái/current pointer/attempt reference. Không thể khôi phục trạng thái đã bị rewind trước migration; không tự coi mọi draft cũ là đã duyệt.

Topic snapshot được ghi khi insert item của attempt, giữ ID/title/metadata để rename/retag/delete taxonomy sau đó không đổi thống kê bài ấy. Attempt đã tồn tại trước migration được đánh dấu legacy_backfill từ taxonomy lúc nâng cấp; không giả rằng đó là taxonomy lúc tạo bài. Kết quả submitted đã lưu được giữ nguyên. Multi-topic vẫn tính câu vào mỗi topic như trước, không tự chọn topic chính hoặc ép tổng topic bằng tổng bài.

## Ghi nội dung

Revision và đủ bốn choices phải cùng transaction; chọn current revision trong transaction tương ứng. Nội dung đã seal cần tạo revision mới. Không xóa ledger hoặc tắt trigger để sửa câu tại chỗ. User runtime không được ghi ledger/lock tables trực tiếp.

Các writer cây/revision dùng giao thức khóa chung ở DB. Nếu gặp40001/40P01 phải rollback và retry **cả transaction** trên snapshot mới, không retry từng statement trong transaction đã lỗi. Không có writer/import UI mới trong đợt này; P04 vẫn cần cổng Google live và luồng lifecycle riêng.

## Contract và evaluator

Kết quả không được có counts âm/mâu thuẫn hoặc score lệch cách làm tròn. Topic có thể chồng lặp nhưng mỗi topic phải là tập con hợp lệ của bài. Evaluator/runner từ chối fixture rỗng/trùng ID/sai cấu trúc; self-check nguồn tổng hợp không chứng minh độ chính xác Dược, quyền API hoặc model benchmark thật.

Nếu cần rollback schema, dùng forward migration được review và bảo toàn snapshot/ledger; không xóa registry/hash hoặc hạ guard bằng cách sửa migration cũ.
