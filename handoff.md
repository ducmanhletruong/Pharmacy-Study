# Bàn giao sửa đợt1

Worktree `/workspace/pharmacy-study-cr0001`, branch `fix-review-p1`.
Nguồn trạng thái/kiểm chứng: [docs/status.md](docs/status.md), mục sửa P1.
Phạm vi: RV-01 cấu hình CI main và RV-02 write skew MCQ; P2/P3 còn OPEN.

Migration0004 thêm unique normalized choice text, không sửa SQL đã chạy.
Chạy db:migrate bằng maintenance credential; invalid duplicate data sẽ chặn migration.
Không tự sửa text cũ hoặc xóa volume để vượt kiểm.
Unique kiểm ngay; text swap tạm trùng phải dùng revision mới hoặc giá trị trung gian.
B-tree PostgreSQL có giới hạn kích thước key, cần lưu ý khi nhập text dài.

Regression hai writer dùng fixture riêng, statement/lock timeout và cleanup.
Probe launcher production dùng env đọc từ job YAML, port riêng để giữ server3000.
Đang hoàn tất PR/CI; kết quả mới nhất chỉ ghi ở docs/status.md.

Không sửa các finding khác, không merge/deploy hoặc mở P04.
P03 Google live vẫn pending; quyền nguồn/by_topic giữ nguyên.
