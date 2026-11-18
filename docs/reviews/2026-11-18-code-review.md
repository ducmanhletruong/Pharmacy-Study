# Review code đến P03 + CR-0001 — 2026-11-18

Snapshot: `b53016dd4ce328ab7487c3994e293279361803ee`, branch sản phẩm `phase-02-hardening`. Review do chủ dự án yêu cầu; các đề xuất dưới đây **chưa được thực hiện**. Không sửa logic sản phẩm, migration, dependency hoặc workflow trong lượt review.

## Kết luận

Nền tảng đã có owner filter, kiểm quyền, transaction cho answer/submit và test tích hợp tốt hơn trước. Tuy nhiên, CI xanh trước đó chưa chứng minh các trường hợp đồng thời, mất DB, response đến muộn hoặc cấu hình workflow `main` đều an toàn. Có hai mục P1 cần xử lý trước khi đưa stack vào main/mở luồng ghi nội dung; các mục P2/P3 có thứ tự bên dưới.

Phạm vi review chính: code vận hành practice/auth/API/schema/UI, launcher/provision/CI/security gate. Đội gồm sáu subagent chuyên trách auth, DB/concurrency, grading/API, UI, vận hành và công cụ/spike; root đối chiếu, loại trùng và tổng hợp. Kết quả: 2 mục P1, 11 mục P2 và 3 mục P3; các mục P3 gồm đề xuất hardening, không đồng nghĩa đã xảy ra sự cố sản phẩm. Không phải kiểm thử xâm nhập đầy đủ hoặc chứng nhận chính xác kiến thức Dược.

## Quy ước bằng chứng và mức độ

- **PG thật:** probe gọi PostgreSQL trên DB thử riêng, fixture UUID riêng; rollback hoặc dọn đúng fixture sau phép thử hai connection. Không tắt trigger, không đổi schema hay seed.
- **Browser thật + API mock:** chạy component gốc qua Next/Chromium; mock API để chủ động điều khiển timeout/404/thứ tự response. Không ghi DB.
- **Fault injection:** chạy code gốc hoặc thư viện thực tế với DB/FS lỗi giả lập. Không đồng nghĩa đã xảy ra sự cố thật trên tài khoản người dùng.
- **Tĩnh:** kết luận từ đường gọi/SQL; nêu rõ phần chưa chạy. Không suy từ Credentials test provider rằng Google OAuth thật đã được kiểm.
- **P1:** chặn tích hợp hoặc vi phạm bảo đảm toàn vẹn quan trọng; sửa trước khi phát hành/mở writer. **P2:** lỗi chức năng hoặc khả năng phục hồi, cần sửa có mục tiêu. **P3:** củng cố kiểm chứng/giảm lộ chi tiết; chưa chứng minh làm sai kết quả thật.

## Danh sách phát hiện

| ID    | Mức | Phát hiện                                                            | Bằng chứng                                                |
| ----- | --- | -------------------------------------------------------------------- | --------------------------------------------------------- |
| RV-01 | P1  | Workflow main thiếu APP_ORIGIN, startup production thất bại          | Subprocess với env tương đương job                        |
| RV-02 | P1  | Hai writer tạo được lựa chọn trùng dù constraint trigger hiện có     | Hai transaction PG thật, COMMIT đồng thời                 |
| RV-03 | P2  | Logout có thể báo xong nhưng chưa revoke DB session                  | Fault injection vào NextAuth thực tế                      |
| RV-04 | P2  | Quota auth chung cho phép outsider chặn cả login/logout              | Handler thật + PG rollback                                |
| RV-05 | P2  | Response cũ đưa người dùng trở lại bài sau reset                     | Browser thật, giữ/thả response                            |
| RV-06 | P2  | Link attempt lỗi làm mất luôn bộ luyện và reset không phục hồi       | Browser thật + attempt404                                 |
| RV-07 | P2  | Provision lỗi giữa chừng có thể để role tồn tại nhưng mất credential | Chạy control flow gốc với DB/FS fake                      |
| RV-08 | P2  | Audit gate nhận report thiếu/sai kiểu high/critical                  | Gọi classifier thật với report synthetic                  |
| RV-09 | P2  | Seal đảo ngược khi lùi trạng thái/current revision                   | PG thật, không disable trigger                            |
| RV-10 | P2  | Chu trình topic hợp lệ ở DB nhưng biến mất trong tree API            | PG thật + đối chiếu thuật toán                            |
| RV-11 | P2  | UI bỏ chủ đề cấp ba trở xuống                                        | Browser thật + tree ba cấp                                |
| RV-12 | P2  | Thống kê topic thay đổi theo taxonomy sau khi tạo bài                | Gọi submitAttempt thật, transaction rollback              |
| RV-13 | P3  | Backend exception có thể đi vào URL callback                         | Callback/thư viện thật với sentinel; OAuth đối chiếu tĩnh |
| RV-14 | P3  | Contract kết quả nhận số đếm âm/mâu thuẫn                            | Schema thật với dữ liệu synthetic                         |
| RV-15 | P2  | Recorder mất observation khi ghi capture đồng thời                   | Năm process CLI gốc trên capture synthetic                |
| RV-16 | P3  | LLM evaluator có thể pass khi fixtures rỗng                          | Hàm evaluator thật với mảng rỗng                          |

### RV-01 — Workflow main không tương thích cấu hình production

Vị trí: [ci.yml:21](../../.github/workflows/ci.yml#L21), [ci.yml:58](../../.github/workflows/ci.yml#L58), [config.ts:55](../../apps/web/src/config.ts#L55).

Workflow P00 còn chạy khi PR/push `main`, chỉ đặt telemetry env nhưng gọi `pnpm start`. Config hiện bắt buộc APP_ORIGIN trong production. Mô phỏng `start.mjs` với môi trường tương đương job trả `exit=1`, `rejected_missing_origin=true`, không timeout. Chưa chạy riêng toàn workflow/build P00 trong review; ít nhất startup/health gate chắc chắn không đạt.

CI của PR #5 vào `phase-03` không chạy workflow này, nên kết quả xanh trước đó không mâu thuẫn phát hiện. **Sửa tối thiểu:** cấu hình AUTH_MODE=disabled và APP_ORIGIN nhất quán với cổng health của job, hoặc hợp nhất các job mà giữ kiểm health tương đương. **Regression:** kiểm startup/config cho từng workflow còn hoạt động và PR vào main.

### RV-02 — Deferred validation không chống write skew

Vị trí: [0003:15](../../packages/db/migrations/0003_integrity_hardening.sql#L15), [0003:37](../../packages/db/migrations/0003_integrity_hardening.sql#L37).

Fixture draft có bốn text khác nhau. Transaction T1 đổi label A thành X; T2 đổi label B thành X. Ở READ COMMITTED, hai lần COMMIT đồng thời đều thành công với trigger mặc định deferred, không cần tắt guard hay ép constraint immediate. Trạng thái cuối `total=4`, `distinct_texts=3`. Mỗi transaction đã kiểm trên ảnh chụp chưa thấy thay đổi chưa commit của bên kia.

`app_rw` hiện không được sửa ngân hàng, nên đây **không phải bypass learner API**. Đây là lỗi bảo đảm DB, ảnh hưởng writer/importer/maintenance hợp lệ; cần sửa trước P04. **Sửa:** unique index trên `(revision_id, lower(btrim(text)))`; nếu cần đổi chéo text trong một transaction thì dùng cột normalized + DEFERRABLE UNIQUE. Serialize writer trên parent revision từ trước khi ghi; không chỉ thêm khóa ở cuối deferred check. **Regression:** hai connection với timeout, ít nhất một transaction phải bị từ chối và dữ liệu cuối vẫn hợp lệ.

### RV-03 — Xóa cookie không đồng nghĩa revoke thành công

Vị trí: [options.ts:165](../../apps/web/src/server/auth/options.ts#L165), [auth.ts:125](../../packages/db/src/auth.ts#L125). Thư viện: installed NextAuth `core/routes/signout.js`, catch lỗi event rồi tiếp tục clear cookie/redirect.

App đặt revoke trong `events.signOut`. Khi revoke hoặc audit bị lỗi DB, NextAuth bắt exception, log SIGNOUT_ERROR, vẫn xóa cookie trình duyệt và redirect `/login`. Fault injection vào thư viện thực tế cho `browserSessionCleared=true`, `revocationSucceeded=false`. Chưa tiêm outage xuyên HTTP trong review.

Nếu ai đã giữ bản sao cookie cũ, cookie đó có thể dùng lại sau khi DB hồi phục, tới hết session tối đa tám giờ. Không chứng minh cookie thật bị đánh cắp. **Sửa:** logout do app kiểm soát phải hoàn tất durable revoke trước khi báo thu hồi phiên thành công; lỗi trả retryable và cho biết việc thu hồi chưa xong. **Regression:** DB/audit thất bại khi logout, sau đó phục hồi và retry; bản cookie cũ chỉ được coi đã thu hồi khi transaction thành công.

### RV-04 — Bucket auth toàn cục làm logout phụ thuộc outsider

Vị trí: [auth route:23](../../apps/web/src/app/api/auth/[...nextauth]/route.ts#L23).

Mọi callback và POST, gồm signout, dùng `auth:anonymous`, trước khi kiểm body/CSRF. Probe với RATE_LIMIT_AUTH=1: signin không xác thực, body quá lớn trả413; signout không liên quan sau đó trả429, Retry-After60. Mặc định cùng vấn đề sau120 request/phút; callback GET sai cũng có thể tiêu quota. Shared budget đã được runbook ghi như giới hạn, review này xác nhận tác động chặn logout cụ thể.

**Sửa:** tách budget logout đã xác thực theo user/session; lớp anonymous cần giới hạn theo client từ trusted edge và một global cap cao hơn. Không tin trực tiếp header IP do client tự đặt. **Regression:** flood callback lỗi nhưng thành viên khác vẫn logout và phiên cũ bị revoke.

### RV-05 — Response đến muộn khôi phục state đã reset

Vị trí: [practice.tsx:167](../../apps/web/src/components/practice.tsx#L167), [practice.tsx:173](../../apps/web/src/components/practice.tsx#L173), [practice.tsx:219](../../apps/web/src/components/practice.tsx#L219).

Browser thật: bấm bắt đầu, giữ response POST, bấm logo về trang chủ, rồi thả response. Sau reset URL `/`, không có câu; sau response cũ, câu xuất hiện lại và URL đổi `/?attempt=...`. Callback không được vô hiệu khi reset. Answer/finish có cùng mẫu cập nhật state nhưng hai nhánh này mới kiểm tĩnh.

**Sửa:** generation token hoặc AbortController, kiểm tác vụ còn hiện hành trước mọi setState/history/finally. Abort ở client không hoàn tác server write nên vẫn cần generation guard. **Regression:** giữ/thả từng mutation trong lúc reset/chuyển bài; response cũ không được thay state/URL mới.

### RV-06 — Resume thất bại làm mất dữ liệu subjects đã tải

Vị trí: [practice.tsx:94](../../apps/web/src/components/practice.tsx#L94), [practice.tsx:105](../../apps/web/src/components/practice.tsx#L105), [practice.tsx:219](../../apps/web/src/components/practice.tsx#L219).

Subjects trả một bộ hợp lệ nhưng attempt404 làm Promise.all reject, nên setSubjects không chạy. Bấm logo bỏ query vẫn không tải lại subjects: UI trống và báo chưa có bộ. Nút reload khi vẫn giữ URL lỗi lặp lại sự cố.

**Sửa:** tải danh sách độc lập với resume; khi resume lỗi có thao tác bỏ attempt/query và quay lại bộ đã tải thành công. **Regression:** attempt sai/404/401/timeout không làm mất bộ luyện; phân biệt hết phiên với không có dữ liệu.

### RV-07 — Provision chưa có khả năng khôi phục sau lỗi một phần

Vị trí: [provision.ts:73](../../packages/db/src/provision.ts#L73), [provision.ts:107](../../packages/db/src/provision.ts#L107), [provision.ts:126](../../packages/db/src/provision.ts#L126).

CREATE ROLE và GRANT autocommit, credential mới chỉ được ghi file sau các bước này. Nếu grant/probe/IO hỏng ở giữa, role có thể tồn tại mà secret chưa lưu. Fault injection thực thi control flow source với DB/FS fake cho lượt đầu `created=true,writes=0,exit=1`; chạy lại từ chối role tồn tại không có credential tương ứng. Không tạo/sửa role thật để kiểm lỗi này.

**Sửa:** lưu credential dự kiến vào journal private có thể khôi phục trước DDL, gom role changes vào transaction phù hợp, ghi file bằng atomic rename và thiết kế resume rõ ràng. Không tự xoay mật khẩu role có sẵn. **Regression:** failpoint sau từng DDL/probe/write, chạy lại phải khôi phục được mà không mất secret/ghi đè role ngoài tác vụ.

### RV-08 — Malformed audit report có thể được coi hợp lệ

Vị trí: [audit-report.mjs:3](../../scripts/audit-report.mjs#L3), [audit-report.mjs:12](../../scripts/audit-report.mjs#L12).

Classifier thật nhận `{metadata:{vulnerabilities:{}},advisories:{}}` và trả `unmitigated:[]`. Tương tự với high/critical là chuỗi `unknown`. So sánh số với undefined/NaN không vào nhánh từ chối. Root đã gọi lại hai trường hợp và xác nhận.

Đây là bug fail-closed khi thiếu/đổi schema report, **không chứng minh registry thật từng trả dữ liệu đó hoặc advisory hiện tại đã bị lọt**. **Sửa:** validate report schema, bắt buộc severity counts là integer hữu hạn không âm; kiểm consistency/exit status subprocess. **Regression:** thiếu key, sai kiểu, NaN, số âm và advisory/count không khớp phải fail.

### RV-09 — Seal chưa lưu lịch sử bất biến

Vị trí: [0003:65](../../packages/db/migrations/0003_integrity_hardening.sql#L65).

Hai probe PG thật: verified→draft làm seal true→false và sửa được revision; revision r1 đã bị r2 thay thế cũng sửa được sau khi current pointer quay về r1. Không cần DISABLE TRIGGER/ALTER. Revision vẫn có attempt trỏ tới không bị gỡ seal bằng các đường này; đối chứng reparent revision đã có attempt bị23001 như thiết kế.

Với ý nghĩa “đã duyệt/đã bị thay thế phải tạo revision mới”, điều kiện dựa trên trạng thái hiện tại chưa đủ. Runtime chưa có writer API nên phạm vi hiện tại là maintenance và nền P04. **Sửa:** lưu dấu seal không được đảo ngược, chẳng hạn sealed_at và guard cập nhật nó; publish/replacement/attempt reference cùng giao thức khóa với content writer. **Regression:** hạ status/quay pointer không mở lại nội dung đã sealed.

### RV-10 — Topic cycle được lưu nhưng biến mất khỏi API

Vị trí: [0001:15](../../packages/db/migrations/0001_practice.sql#L15), [practice.ts:67](../../packages/db/src/practice.ts#L67).

DB chỉ cấm self-parent. A.parent=B và B.parent=A được chấp nhận: `total=2,roots=0`. API xây cây từ roots nên component này biến mất, không báo dữ liệu sai. PG đã kiểm chu trình; kết quả API đối chiếu từ thuật toán, không gọi HTTP cho fixture cycle.

**Sửa:** kiểm ancestor khi đổi parent; có serialize theo cây/subject hoặc isolation+retry để chống hai writer đồng thời tạo cycle. API nên phát hiện node không reachable. **Regression:** cycle hai/ba node, đổi parent đồng thời và cây hợp lệ nhiều cấp.

### RV-11 — Dropdown bỏ các topic sâu hơn hai cấp

Vị trí: [practice.tsx:54](../../apps/web/src/components/practice.tsx#L54).

Browser thật với tree hợp lệ ba cấp cho root1, child1 nhưng grandchild0 option. TopicOptions chỉ map root và children, không recurse. Seed hai cấp không bắt được lỗi này.

**Sửa:** flatten cây bằng đệ quy thành option có depth label, tránh optgroup lồng nhau. **Regression:** ít nhất ba cấp và gửi đúng topic ID đã chọn vào API.

### RV-12 — Taxonomy của attempt chưa được snapshot

Vị trí: [practice.ts:312](../../packages/db/src/practice.ts#L312).

Hai attempt pin cùng revision, cùng được tạo trước khi taxonomy đổi. Nộp bài thứ nhất ghi topic before; đổi question_topics cùng môn; nộp bài thứ hai ghi topic after. Cả hai điểm10. Probe gọi submitAttempt thật với savepoint trong transaction ngoài luôn rollback.

Đây là rủi ro tái lập thống kê trước P05, không phải lỗi điểm và không phải câu hỏi OPEN “một câu nhiều topic tính vào đâu”. Kết quả đã submit được lưu và replay nguyên trạng; điểm yếu là taxonomy thay giữa tạo và submit. **Sửa:** snapshot association/title theo attempt creation hoặc revision bất biến. **Regression:** đổi/xóa/đổi tên topic sau tạo bài không làm thay thống kê snapshot đã chọn.

### RV-13 — Lỗi backend chưa được chuẩn hóa ở redirect callback

Vị trí: [options.ts:115](../../apps/web/src/server/auth/options.ts#L115). Installed NextAuth `core/routes/callback.js` chuyển error.message từ signIn exception vào URL error.

Probe gọi authOptions thực tế với DB connect giả lập lỗi sentinel và thư viện Credentials callback, xác nhận sentinel có trong redirect. Nhánh OAuth có cách catch tương tự, mới đối chiếu tĩnh, không gọi Google. Logger đã sanitize nhưng redirect chưa được bảo vệ theo cùng cách. Không có bằng chứng lộ password/token thật.

**Sửa:** bắt lỗi identity, log mã cố định + request ID an toàn và trả lỗi public cố định/false; không đưa exception backend thô ra URL. **Regression:** sentinel không xuất hiện ở redirect/history/public error.

### RV-14 — Result contract thiếu quan hệ giữa các số đếm

Vị trí: [api-contract/index.ts:73](../../packages/api-contract/src/index.ts#L73).

Schema nhận total1/correct9/unanswered-2/score9. Chưa phát hiện service hiện tại tạo output này; đây là thiếu lớp bảo vệ contract. Query đếm và công thức điểm hiện đang đúng trong phạm vi đã kiểm.

**Sửa:** nonnegative cho số đếm; correct<=total và correct+unanswered<=total; score phù hợp quy tắc làm tròn. Từng topic kiểm quan hệ nội bộ, không ép tổng by_topic bằng total khi quy tắc multi-topic còn OPEN. **Regression:** kết quả âm/mâu thuẫn bị từ chối, các kết quả hợp lệ vẫn nhận.

### RV-15 — Atomic rename không chống mất observation

Vị trí: [record.mjs:110](../../spikes/notebooklm/record.mjs#L110).

Recorder đọc capture, append batch rồi rename file tạm nhưng không khóa toàn bộ read–modify–write. Năm process CLI gốc trên bản copy trong /tmp, dùng năm topic khác nhau và capture synthetic, đều báo added_count1; cuối cùng chỉ còn2 observation thay vì5. Cả năm exit2 là mã hợp lệ cho việc đã ghi nhưng chưa đủ gate ba ngày, không phải lỗi CLI.

**Sửa:** lock theo capture xuyên suốt read/validate/write/rename, có cleanup finally và xử lý stale lock; hoặc lưu từng batch bất biến rồi tổng hợp. **Regression:** nhiều process phải giữ đủ mọi observation và không tạo trùng topic/ngày. Không đọc capture thật; không có bằng chứng P01 đã gặp lỗi này hoặc cần chạy lại gate ba ngày.

### RV-16 — Zero-fixture evaluator có thể xanh mà chưa đánh giá gì

Vị trí: [evaluate.mjs:73](../../spikes/llm-eval/evaluate.mjs#L73).

Probe evaluateCandidates([],[]) trả fixture_count0, passed_count0, passedtrue vì every trên mảng rỗng. Fixture chuẩn hiện có năm mục nên chưa ảnh hưởng kết quả đã ghi. Đây là đề xuất validation đầu vào của runner; nếu evaluator cố ý cho phép zero cases theo nghĩa hàm generic thì giữ hàm và kiểm ở CLI.

**Sửa:** runner bắt buộc fixtures không rỗng, ID duy nhất và đúng cấu trúc. **Regression:** fixture bị xóa rỗng/sai schema phải trả lỗi rõ ràng, không được báo benchmark đạt.

## Kiểm tra không phát hiện lỗi và giới hạn

- Probe đã kiểm mọi **65 cặp correct/total hợp lệ**, total từ1 đến10; điểm làm tròn khớp phép tính hữu tỉ bằng số nguyên. Không tìm thấy sai số trong giới hạn count hiện tại; không suy rộng cho calc-engine chưa làm.
- Schema từ chối count dạng chuỗi, NaN, Infinity,0,11.
- Revision có attempt vẫn bị chặn reparent/sửa; không tìm thấy bypass learner ownership/role/allowlist trực tiếp trong các đường đã review. Đây không phải chứng minh không còn lỗ hổng.
- Answer/submit dùng khóa parent; submit replay trả kết quả lưu. Các test cũ và CI đã đạt được tham chiếu từ docs/status.md, không chạy lại toàn suite/build trong review.
- Chưa kiểm Google OAuth thật, bảo mật tài khoản Google, load test production, mọi browser/accessibility, nguồn giáo trình private hoặc độ chính xác chuyên môn.
- Khả năng audit/report registry thiếu dữ liệu và DB outage logout được fault injection, không phải sự cố thật đã quan sát ở tài khoản người dùng.

## Phương án nâng cấp theo thứ tự

| Đợt đề xuất                            | Mục tiêu                | Điều kiện hoàn thành                                                                                                                                                                              |
| -------------------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A — trước đưa stack vào main/mở writer | RV-01, RV-02            | CI main có env đúng; hai writer không tạo được text trùng; migration forward mới và concurrency regression                                                                                        |
| B — phục hồi và an toàn phiên/UI       | RV-03..08, RV-13, RV-15 | Logout lỗi DB không báo thu hồi thành công giả; flood không khóa logout; UI không nhận response cũ và phục hồi resume; provision retry được; malformed audit fail; recorder không mất observation |
| C — trước nội dung nhiều tầng/P04/P05  | RV-09..12, RV-14, RV-16 | Seal bất biến, cây không cycle/render đủ cấp, taxonomy snapshot có quyết định rõ contract số đếm chặt và runner không pass zero fixtures                                                          |

Đây là đề xuất, chưa triển khai. Không sửa SQL0001/0002/0003 đã áp; nếu sửa DB thì thêm migration forward mới (dự kiến0004). Không thêm cache/queue/framework hoặc nâng dependency hàng loạt để xử lý các lỗi có thể sửa cục bộ. Sau sửa, chạy regression theo lỗi; chỉ build/E2E rộng hơn khi phạm vi thực sự ảnh hưởng hoặc cổng phase yêu cầu.

Giữ riêng các quyết định chưa chốt: Google live của P03, quyền phân phối tài liệu cho lớp, by_topic nhiều chủ đề, AI entitlement/billing và hosting. Review này không tự chốt chúng hoặc mở P04.

## Dấu vết probe của lượt review

Các file dưới `/tmp` chỉ phục vụ lần chạy này, có thể mất sau khi môi trường được thay; kịch bản, mức bằng chứng và kết quả quan trọng đã lưu trong báo cáo này:

- `pharmacy-review-db-default-concurrency.mts`, `pharmacy-review-db-probe.mts`, `pharmacy-review-db-cycle-seal.mts`.
- `pharmacy-review-auth-rate.mts`, `pharmacy-review-auth-signout.cjs`, `pharmacy-review-auth-error.cts`.
- `pharmacy-review-grading-probe.ts`, `pharmacy-review-ui-probe.cjs`, `pharmacy-review-ops-provision.mjs`, `pharmacy-review-tooling.mjs`.

Server UI riêng port3003 đã dừng; DB fixture committed tạm cho concurrency đã được dọn, các probe còn lại rollback. Không sửa DB P02/P03 gốc hoặc copy cookie/secret; không gọi dịch vụ AI/Google có trả phí.
