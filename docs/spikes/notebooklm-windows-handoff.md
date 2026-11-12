# P01-T01 — Lượt kiểm chứng tại Windows

Ngày chuẩn bị: 2026-11-12 (Asia/Saigon). Chưa chạy truy vấn kiến thức từ Cloud. Chủ dự án xác nhận nguồn trong năm notebook được phép dùng cá nhân, không công khai giáo trình. Windows đã gọi notebook_list thành công (47 notebook); không cần đăng nhập lại.

Recorder/validator chỉ cần Node.js 24 theo `.nvmrc`; không cần pnpm install, Python venv mới hoặc build app để ghi capture. Dùng MCP Windows hiện có, không cài lại server nếu kết nối đang hoạt động.

## Nội dung gửi vào chat local đang có MCP

Đoạn dưới đây giao việc cho phiên Windows; chỉ có hiệu lực khi chủ dự án gửi ở đó. Agent Cloud chưa gửi hoặc thực thi thay.

```text
Tiếp tục P01-T01 của Pharmacy-Study bằng MCP NotebookLM đang hoạt động trên Windows.

Nguồn trong 5 notebook được tôi xác nhận có quyền dùng cho học tập cá nhân; không công khai giáo trình. Không cần đăng nhập lại. Chỉ đọc notebook/source và truy vấn nội dung hiện có; không tạo/xóa/sửa notebook, note, nguồn, không research/web search, không đổi cấu hình hoặc credential.

1. Tìm checkout Pharmacy-Study đã có. Nếu chưa có, clone https://github.com/ducmanhletruong/Pharmacy-Study.git vào thư mục mới, checkout phase-01; không reset hoặc ghi đè checkout đang có thay đổi. Đọc AGENTS.md, handoff.md, docs/spikes/notebooklm-access.md và docs/spikes/notebooklm-windows-handoff.md. Nếu chưa có file handoff này trên remote, báo thiếu; không tự triển khai phase khác.
2. Kiểm tra tool thực tế, dùng notebook_list để xác định đúng 5 môn trong plan: Hóa phân tích 1, Hóa hữu cơ 2, Giải phẫu sinh lý, Kinh tế chính trị, Vi sinh ký sinh 1. Dùng notebook_get để xem nguồn; chỉ hỏi nếu có nhiều notebook trùng môn hoặc thiếu môn. Không đưa toàn bộ danh sách notebook vào báo cáo.
3. Tạo spikes/notebooklm/private/access.capture.json từ capture.template.json nếu chưa có. Giữ hồ sơ cũ nếu đã tồn tại. Ghi server/version/transport thực tế, quyền nguồn tôi đã xác nhận và thông tin đọc điều khoản thật. Không lấy version Cloud để điền cho Windows. Đọc điều khoản theo link trong runbook, ghi thời điểm/người đọc/ghi chú thực tế; nếu không đọc được, báo thiếu.
4. Chọn một chủ đề ngắn có thật từ nguồn của mỗi môn. Lưu 5 topic id/label và mapping notebook/source trong private; các ngày sau dùng lại cùng 5 chủ đề. Chỉ thực hiện một lượt cho mỗi chủ đề hôm nay. Dùng notebook_query với đúng source_ids nếu tool hỗ trợ; hỏi đoạn ngắn nguyên văn cùng source ID và trang/mục/vị trí cụ thể. Không sáng tác vị trí nếu phản hồi chỉ có [1]. Có thể dùng source_get_content để đối chiếu nguồn nếu tool đó hiện có. Không coi model nói đúng là đã grounded.
5. Lưu output nguyên bản trong private và observed_at là thời điểm truy vấn thật. Tạo batch JSON array theo ví dụ bên dưới. Chỉ đặt grounded_verified=true sau khi đối chiếu chính trích đoạn và vị trí với nguồn gốc. Nếu chưa xác minh được, giữ output riêng với trạng thái pending; không nhập vào capture đã đạt và báo chủ dự án phần cần kiểm. Không bịa excerpt, hash, citation, ngày hoặc xác nhận của con người.
6. Với các observation đã đối chiếu đủ, chạy node spikes/notebooklm/record.mjs spikes/notebooklm/private/access.capture.json spikes/notebooklm/private/day-batch.json. Exit 2 với added_count > 0 nghĩa là đã lưu ngày hiện tại nhưng chưa đủ 3 ngày; không retry để giả lập ngày. Không build hoặc chạy toàn bộ test. Không commit raw capture/batch/nguồn/ID notebook/cookie. Chỉ báo số chủ đề có citation đã xác minh, số ngày đủ, lỗi/thiếu còn lại; chưa đánh dấu P01 DONE hoặc sang P02.
```

## Batch riêng tư và cách ghi

Ví dụ **chỉ mô tả cấu trúc**, không phải observation thật. `topic_id` phải khớp hồ sơ đã tạo. Thay thời gian, trích đoạn và vị trí bằng dữ liệu thật; không dùng placeholder để vượt cổng.

```json
[
  {
    "topic_id": "topic-1",
    "observed_at": "THOI_DIEM_TRUY_VAN_ISO_8601_THAT",
    "response_ok": true,
    "grounded_verified": false,
    "excerpt": "TRICH_DOAN_NGUYEN_VAN_DA_DOI_CHIEU",
    "citations": [
      {
        "source_ref": "NOTEBOOK_ID/SOURCE_ID_THAT",
        "location": "TRANG_HOAC_MUC_THAT"
      }
    ]
  }
]
```

`record.mjs` từ chối observation chưa được đối chiếu, thiếu nguồn/vị trí, thời gian tương lai hoặc chủ đề trùng cùng ngày Việt Nam. Script tự tính SHA-256 UTF-8 và số Unicode code point, chỉ thêm metadata vào capture; không chép excerpt hoặc raw response. Hai file phải nằm trong `spikes/notebooklm/private/` bị Git ignore. Lưu batch nguyên bản ở đó để đối chiếu; không upload lên GitHub.

Script không gọi MCP, không kiểm chứng sự thật thay người chạy và không tự đặt `grounded_verified`. Chỉ nhập phần đã kiểm chứng; lỗi truy vấn/thiếu citation giữ riêng để phản ánh đúng lượt chạy thất bại. Các ngày sau tiếp tục cùng capture, không tạo ngày giả hoặc đặt lịch tự động.

Exit 0: metadata đủ cổng; exit 2: ghi thành công nhưng chưa đủ ba ngày; exit 1: không ghi do input/file không hợp lệ. Báo cáo stdout chỉ chứa count/ngày/lỗi validator, không chứa excerpt hoặc ID notebook. Cần review hồ sơ thật trước khi kết luận khả thi.
