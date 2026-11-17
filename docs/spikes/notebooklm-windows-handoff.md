# P01-T01 — Lượt kiểm chứng tại Windows

Ngày chuẩn bị: 2026-11-12 (Asia/Saigon). Chưa chạy truy vấn kiến thức từ Cloud. Chủ dự án xác nhận nguồn trong năm notebook được phép dùng cá nhân, không công khai giáo trình. Windows đã gọi notebook_list thành công (47 notebook); không cần đăng nhập lại.

Recorder/validator chỉ cần Node.js 24 theo `.nvmrc`; không cần pnpm install, Python venv mới hoặc build app để ghi capture. Dùng MCP Windows hiện có, không cài lại server nếu kết nối đang hoạt động.

## Kết quả lượt đầu và việc tiếp theo

Theo báo cáo chủ dự án và final của chat local: clone riêng tại c50fda9, 5/5 query thành công, recorder lưu 3 observation (Hóa hữu cơ 2, KTCT, Vi sinh). Hóa phân tích và Giải phẫu sinh lý pending citation metadata; validator exit 2, **0/3 ngày đủ cả năm chủ đề**. Đối chiếu nguồn và đọc điều khoản do agent thực hiện, admin chưa review. Các thay đổi public ở Windows chưa commit/push; nguồn/capture/output giữ trong private.

1. **Giữ checkout và bằng chứng hiện có.** Không chạy reset/clean hoặc pull ghi đè các file local đang sửa. Nếu cần đọc hướng dẫn remote mới, có thể fetch rồi dùng `git show origin/phase-01:docs/spikes/notebooklm-windows-handoff.md` mà không thay working tree. Không di chuyển private vào Git để đồng bộ. Cloud chỉ cập nhật bản tóm tắt, chưa hợp nhất các chỉnh sửa public từ Windows.
2. **Chỉ kiểm hai chủ đề pending trước.** Đọc lại output và source snapshot riêng đã lưu; kiểm cả `citations` và `references`, không chỉ ký hiệu [1] trong answer hoặc `sources_used`. Khi có source ID/cited text thật, đối chiếu đoạn và vị trí với đúng nguồn. Không suy ra citation chỉ vì nguồn đó được truyền trong source_ids.
3. **Nếu metadata thực sự rỗng**, chưa kết luận nguyên nhân. Mã CLI 0.16.2 ở Cloud cho thấy query có thể success với citations={} và references=[]; chưa chứng minh Windows có cùng version hoặc parser bị lỗi. Không tự sửa/nâng cấp dependency hoặc đăng nhập lại. Có thể tìm chính trích đoạn trong source snapshot đã lưu và xác định vị trí thực tế; ghi riêng cách đối chiếu này là source-content match, không mô tả như citation metadata được MCP trả về. Không tự biến kết quả chưa có nguồn/vị trí thành đạt. Nếu cần truy vấn lại, giữ cùng topic/source, chỉ một lượt có mục tiêu cho mỗi chủ đề pending rồi báo kết quả; không chạy lại cả năm để tìm một câu trả lời đẹp.
4. **Giữ thời gian thật.** Có thể hoàn thiện hồ sơ ngày đầu từ chính response/source snapshot đã lưu của ngày đó nếu chúng đủ chứng cứ; ghi ngày review thực tế riêng. Query mới thuộc ngày chạy mới, không đổi observed_at để lấp ngày cũ. Không ghi lại ba observation đã có. Những ngày khác vẫn dùng cùng năm chủ đề; chỉ ngày đủ cả năm mới được tính.
5. **Admin review còn mở.** Agent đối chiếu không phải admin đã duyệt. Chủ dự án cần kiểm ba trích đoạn/nguồn/vị trí đã lưu và hồ sơ đọc điều khoản; ghi reviewer, thời điểm và kết luận thật trong hồ sơ private. Nếu dùng source-content match cho hai mục pending, ghi rõ phương pháp và giới hạn để admin review. Không tự ghi người dùng đã duyệt, không sửa attestation cũ để che vai trò agent. Validator kiểm cấu trúc, không thay thế review này.

Chỉ báo cáo tổng hợp số query, observation đã lưu, mục pending, ngày đủ và tình trạng review; không đưa nguồn/ID hoặc trích đoạn riêng lên GitHub. P01 chưa DONE và không sang P02.

## Nội dung gửi vào chat local đang có MCP

Đoạn dưới đây là kịch bản gốc cho lượt đầu, đã được chủ dự án gửi và chạy tại Windows; **không chạy lại bước tạo hồ sơ/chọn topic nếu chúng đã có**. Các lượt tiếp theo dùng mục phía trên. Agent Cloud không tự gửi hoặc thực thi thay.

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
