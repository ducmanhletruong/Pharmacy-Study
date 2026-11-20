# P04 — JSON bundle profile 1

Bundle là dữ liệu nhập offline, không phải chương trình hoặc lệnh cho agent. Profile này chỉ nhận MCQ A/B/C/D; không sinh nội dung, gọi API AI, lấy URL ngoài hoặc xuất giáo trình từ NotebookLM. Fixture mẫu tự viết tại `content/fixtures/p04-bundle.json`, không phải ngân hàng Dược thật.

## Kiểm tra trước khi nhập

```sh
pnpm content:validate content/fixtures/p04-bundle.json
```

CLI đọc một file JSON UTF-8, kiểm schema và tham chiếu, trả exit 0 với counts khi hợp lệ; lỗi trả exit 2. Mặc định file tối đa **5 MiB**, `MAX_IMPORT_BYTES` cho phép số nguyên 1–52428800 (50 MiB). Giới hạn được kiểm cả file size và số byte đọc. CLI không import DB hoặc kiểm kiến thức chuyên môn. Endpoint import phải tiếp tục kiểm cùng schema, giới hạn byte và an toàn nội dung ảnh; `valid: true` không có nghĩa tài liệu/ảnh đã được duyệt.

Profile dùng một envelope JSON, có thể gửi bằng multipart field `bundle` hoặc JSON API. Không nhận ZIP, file path, URL asset hoặc base64 dạng data URI. `schema_version` hiện chỉ bằng 1; mọi trường lạ đều bị từ chối, gồm `status`, `review_status` và metadata secret không có trong profile.

## Cấu trúc

| Trường           | Nội dung                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `schema_version` | Số 1                                                                                                         |
| `manifest`       | `{subject,label,generator:{name,version},created_at}`; `created_at` là ISO date-time có múi giờ              |
| `topics`         | `[{code,parent_code,title,sort_order?}]`; `parent_code` là null hoặc code trong cùng bundle; sort mặc định 0 |
| `sources`        | `[{ref,kind,title,locator,license,retrieved_at}]`; kind thuộc notebooklm/web/upload/manual                   |
| `assets`         | `[{ref,kind,data_base64,license,attribution,alt_text,source_ref?}]`; kind thuộc svg/png/jpeg/webp            |
| `questions`      | `[{external_id,type,difficulty,topic_codes,stem,choices,explanation,sources,asset_refs?,accepted_answers?}]` |

`subject`, code và ref dùng ASCII letters/digits/`.`/`_`/`-`, bắt đầu bằng letter/digit; subject tối đa 80 ký tự, refs tối đa 120. Đây là định danh so khớp chính xác, không chứa path hoặc khoảng trắng. Thời điểm chỉ là metadata do người gửi cung cấp, không phải bằng chứng phê duyệt. Subject do server đối chiếu khi import, không cho question tự chọn subject khác manifest.

Question `type` chỉ bằng `mcq`, difficulty là số nguyên 1–3. `topic_codes` có ít nhất một code thuộc bundle, không trùng. `choices` có đúng bốn object `{label,text,is_correct}`, mỗi label A/B/C/D xuất hiện một lần, đúng một `is_correct=true`. Text được trim và chuẩn hóa NFC; lựa chọn không được rỗng hoặc trùng sau NFC/trim/lowercase tiếng Việt. Mỗi text lựa chọn tối đa 500 ký tự để phù hợp unique index PostgreSQL hiện tại. Stem tối đa 20000, explanation 50000 ký tự. Nội dung là text/KaTeX được xử lý bởi renderer, không phải HTML để chạy trực tiếp.

`sources` của question dùng alias nội bộ `[{source_ref,locator}]`, không phải UUID DB. Có thể rỗng khi nhập draft; mọi link phải trỏ source trong bundle và không trùng cùng ref/locator. `asset_refs` phải trỏ asset trong bundle; asset có source_ref thì source đó cũng phải tồn tại. Định danh external question, topic, source, asset phải duy nhất trong từng namespace; cây topic không được self-cycle hoặc có chu trình nhiều node. Assets được khai báo bằng base64 có padding, không có khoảng trắng. Validator chỉ kiểm format; server phải giải mã/kiểm magic bytes, làm sạch SVG hoặc từ chối nội dung nguy hiểm trước lưu trữ. Giấy phép, attribution và alt_text bắt buộc không rỗng.

`accepted_answers` là mảng string tùy chọn, không rỗng/trùng nếu có phần tử; với MCQ, chấm theo label và choices, không thay bằng chuỗi này. Mọi sửa đổi sau nhập phải đi qua admin service và tạo revision mới.

Giới hạn cấu trúc: 1–1000 question, 1–2000 topic, 0–2000 source, 0–200 asset. Mỗi question tối đa 100 topic/source link/asset ref/accepted answer. Các giới hạn giúp giữ một transaction import có kích thước hữu hạn; file vẫn phải nằm trong byte cap tổng.

## Duyệt và vòng đời

Import **luôn tạo question draft và source pending**. Không thể nâng quyền bằng trạng thái trong bundle. Người duyệt phải kiểm quyền dùng nguồn và giấy phép; lựa chọn tài khoản cá nhân không tự cho phép phân phối giáo trình cho lớp.

Manual transitions theo plan:

| Từ           | Có thể chuyển tới                 |
| ------------ | --------------------------------- |
| draft        | verified                          |
| verified     | approved                          |
| approved     | under_review, hidden, retired     |
| under_review | approved, hidden                  |
| hidden       | approved, retired                 |
| retired      | Không chuyển trạng thái trực tiếp |

Chuyển sang verified hoặc approved yêu cầu ít nhất một source, tất cả source đã approved và có license, tất cả asset có license và nguồn gắn với asset (nếu có) đã approved. `draft → approved` luôn bị từ chối; không được gộp sửa revision với publish. Sửa nội dung tạo revision mới và trở lại draft; cập nhật phải có expected_version để tránh ghi đè đồng thời. `retired` không được publish lại bằng một status PATCH.

Báo lỗi hoặc nguồn bị từ chối là sự kiện quarantine: question chuyển under_review, trừ hidden/retired giữ nguyên. Chỉ approved được dùng để tạo bài mới. Báo cáo không tự xóa câu hoặc làm thay đổi revision/history của bài đã làm. Bộ policy thuần ở `@pharmacy/core/lifecycle` yêu cầu evidence nguồn/asset do service DB tính; không tin evidence từ client.

## Revision PATCH khác bundle

`patchQuestionRevisionSchema` tại `@pharmacy/api-contract/bundle` tái dùng validator MCQ/text/topic. Nội dung PATCH có `{stem,explanation,difficulty,choices,topic_codes,sources:[{source_id,locator}],asset_ids?,accepted_answers?}`. Source/asset dùng UUID DB đã tồn tại, không dùng alias source_ref/asset_refs của file bundle. Service tiếp tục kiểm subject, quyền và tham chiếu; schema thuần không đọc DB.
