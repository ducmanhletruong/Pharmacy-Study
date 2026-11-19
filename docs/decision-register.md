# Sổ quyết định

Ngày dùng múi giờ Asia/Saigon. Không coi ASSUMPTION/PROPOSED là quyết định đã duyệt. Bản plan upload mới nhất được lưu nguyên văn tại `IMPLEMENTATION_PLAN.md`, v0.1 DRAFT; không tự sửa các xác nhận lịch sử của tài liệu.

| ID                 | Trạng thái                          | Nội dung / căn cứ                                                                                                                                                                            | Người quyết                    | Ngày       |
| ------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| CHAT-01 / ADR-0004 | CONFIRMED / Accepted                | Chuyển starter sang Next.js + TypeScript trong pnpm monorepo; trả lời trực tiếp câu hỏi lựa chọn stack trong chat                                                                            | Chủ dự án                      | 2026-11-12 |
| CHAT-02            | CONFIRMED                           | Repo dự án: https://github.com/ducmanhletruong/Pharmacy-Study; được phép tận dụng tài nguyên và tải repo cần thiết. Việc này không tự chốt ngân sách AI/hosting                              | Chủ dự án                      | 2026-11-12 |
| PLAN-P00           | Theo phạm vi tài liệu               | Mục 18 cho phép bắt đầu P00; các phase sau còn cần duyệt chính thức và thông tin tương ứng. P00 local/CI, chưa deploy production                                                             | Plan v0.1 + ngữ cảnh giao việc | 2026-11-12 |
| C-01…C-08          | CONFIRMED trong plan                | Năm môn và yêu cầu nghiệp vụ như mục 2.1 của bản upload. Chưa triển khai nghiệp vụ trong P00                                                                                                 | Tài liệu đầu vào               | 2026-11-12 |
| C-09               | HISTORICAL / cần phân biệt ngữ cảnh | Bản draft ghi “giai đoạn này chỉ lập kế hoạch”. Ngữ cảnh chat hiện tại giao plan để triển khai và đã chọn stack cho P00; không dùng câu lịch sử này để tự kết luận toàn bộ PRD đã được duyệt | Tài liệu + chat                | 2026-11-12 |

## Quyết định chưa chốt

- ADR-0001, ADR-0002 (D-01), ADR-0003, ADR-0005, ADR-0008: PROPOSED.
- ADR-0006, ADR-0007: OPEN, chờ Q5 và Q6 ở P01.
- Q1: MCP NotebookLM không chính thức và quyền sử dụng nguồn.
- Q2: cấu trúc đề, đề cương, quy tắc làm tròn và danh pháp.
- Q3: phạm vi người dùng.
- Q4: thiết bị chính; dùng A-03 responsive/online cho đến khi có thông tin mới.
- Q5: ngân sách hosting/AI và nhà cung cấp ưu tiên.
- Q6: sinh trước rồi duyệt hay sinh trực tiếp, chính sách nguồn web/hình.
- Q7: ngày thi và hạn MVP, chưa chặn P00.
- A-01…A-09, D-01, X-01…X-05 chưa được tự nâng thành CONFIRMED.
- Ngưỡng coverage ở mục 9.4 còn PROPOSED; P00 mới có smoke test, không báo đạt coverage cho module chưa tồn tại.

## Bổ sung P01 — 2026-11-12

- **CHAT-03 — CONFIRMED:** chủ dự án yêu cầu “thực thi tiếp cho tôi”. Cho phép tiếp tục P01 và chuẩn bị/kiểm chứng phần độc lập; không cần xin lại quyền bắt đầu. Không coi đây là duyệt mọi lựa chọn provider hoặc câu trả lời nghiệp vụ OPEN.
- **CHAT-04 — CONFIRMED:** cho phép MCP bên thứ ba, NotebookLM là tài khoản cá nhân. Người dùng báo đã kết nối Codex với NotebookLM. Kiểm tra trong Cloud: không có tool NotebookLM, plugin search rỗng, CLI MCP list 0 server. Chưa biết tên/version/transport server thực; chưa xác nhận kết nối callable ở Cloud.
- **CHAT-05 — CONFIRMED:** ưu tiên dùng OpenAI/ChatGPT Pro của tài khoản hiện có cho AI. Chưa xác minh entitlement, API credit grant, OAuth plan token, model hoặc hạn mức; câu trả lời này không đưa ra ngân sách hosting.
- **P01-T02 — VERIFIED:** RDKit JS/WASM 2026.09.2, 10/10 SVG giống hash giữa hai tiến trình, invalid SMILES bị từ chối; báo cáo thật trong `spikes/chem-render/report.json`. Đây là kết quả spike, không phải duyệt toàn bộ P08.
- Q1 phần cho phép MCP đã giải quyết. Quyền dùng từng nguồn vẫn theo A-07 và phải kiểm tra khi đưa nguồn thật vào hồ sơ. Không suy ra quyền phân phối nguồn từ tài khoản cá nhân.
- ADR-0009 và ADR-0010 bổ sung hồ sơ hosting/OpenAI; PROPOSED về cách tích hợp, không sửa các ADR gốc hoặc tự gán Accepted. Q5 hosting và đường cấp quyền AI đang chờ quyết định/thiết lập thực tế.
- Không có inference API ở spike; reference self-check 5/5 không phải kết quả mô hình. Không đánh dấu đạt cổng P01 khi thiếu bằng chứng NotebookLM năm chủ đề qua ba ngày.

- **CHAT-06 / ADR-0011 — CONFIRMED / Accepted:** chủ dự án chọn “Tiếp tục local, chưa triển khai hosting production (đề xuất)”. Phần lựa chọn môi trường hiện tại của ADR-0009 được thay bằng ADR-0011; production ADR-0006 và ngân sách production vẫn hoãn, không tự chọn Render/Neon. T03 không còn chờ quyết định cho phạm vi local.

- **CHAT-07 — CONFIRMED:** chủ dự án ưu tiên tìm cách nối MCP với NotebookLM. Được tiếp tục cấu hình/thử nghiệm MCP trong môi trường hiện tại; không thay kết nối đã có trên máy riêng.
- **MCP-TRANSPORT — VERIFIED:** đã cài notebooklm-mcp-cli 0.16.2 ở runtime riêng, đăng ký pharmacy-notebooklm với hai tool đọc, MCP initialize/tools/list thực tế đạt (55 tool). Google account chưa xác thực: notebook_list trả lỗi nghiệp vụ dù isError=false. Profile/browser state ở ngoài repo, không có notebook data được commit.
- **MCP-LOGIN — WINDOWS REPORTED SUCCESS / CLOUD UNVERIFIED:** ngày 2026-11-12 chủ dự án cung cấp kết quả notebook_list thành công tại Windows, tài khoản có 47 notebook, chỉ đọc. Cloud auth từng timeout; kết quả Windows không chứng minh native tool hoặc Google auth tại Cloud. Tiếp tục P01-T01 bằng tay ở Windows, không yêu cầu đăng nhập Cloud lại. Chưa có kiến thức/citation cho năm chủ đề qua ba ngày, P01 chưa DONE.
- **CHAT-08 — CONFIRMED:** chủ dự án xác nhận “Có, được phép dùng cá nhân; không công khai giáo trình” cho tài liệu trong năm notebook môn học. Gỡ phần quyền nguồn Q1 cho phạm vi học tập cá nhân; không mở rộng thành quyền xuất bản nguồn.
- **MCP-WINDOWS — HISTORY CHECKED:** đã đọc turn gần nhất của đúng chat local, có notebook_list hoàn thành trên gemini-notebook-mcp và kết luận 47 notebook. Không kích hoạt agent khác, không thay MCP Windows. Năm chủ đề cụ thể và version/transport Windows phải lấy từ lượt chạy thật.
- **LLM-EXPLORATORY — RECORDED:** năm output do Codex sinh trong chat đạt kiểm tra cơ học của evaluator trên nguồn tổng hợp (5/5). Đánh giá không mù, model/version và usage/cost chưa có số xác minh, không phải benchmark chuyên môn hoặc bằng chứng API/plan grant. Report: spikes/llm-eval/codex-session-report.json. ADR-0007/0010 chưa đổi Accepted.
- **MCP-FIRST-RUN — PARTIAL / ADMIN REVIEW PENDING:** chủ dự án cung cấp kết quả lượt đầu tại Windows, clone riêng phase-01 ở c50fda9. 5/5 query thành công; 3 observation của Hóa hữu cơ 2, KTCT và Vi sinh được agent đối chiếu nguồn và recorder lưu. Hóa phân tích và Giải phẫu sinh lý thiếu citation metadata, pending. Validator exit 2, 0/3 ngày đủ năm chủ đề. Lịch sử chat local xác nhận năm notebook_query hoàn thành và final khớp báo cáo; Cloud không đọc raw capture/nguồn. Đọc điều khoản và grounding do agent thực hiện, chưa được admin duyệt. Chưa nâng P01-T01 hoặc P01 thành DONE.

## 2026-11-17 — kết thúc spike và tiếp tục P02

- MCP-3DAYS: 15 observation, đủ các ngày 12/11, 13/11 và 17/11; exit 0 theo chat Windows. Không còn pending citation của lượt đầu. Cloud chỉ đọc lịch sử/final, không tự chạy validator trên capture private.
- CHAT-09 CONFIRMED: chủ dự án trả lời “Đã review và duyệt cả grounding lẫn điều khoản”. P01-T01 DONE.
- ADR-0006 Accepted phạm vi local theo quyết định đã có ADR-0011; production vẫn hoãn. ADR-0007 Accepted lựa chọn OpenAI đã được chủ dự án chốt; không coi là đã có API entitlement.
- Đính chính ranh giới: P01 yêu cầu hồ sơ quyết định và spike, không yêu cầu app gọi API AI thật. Tích hợp đó thuộc P06; những mô tả trước coi API credential là blocker P02 quá chặt so với plan. Không thay đổi plan gốc hoặc âm thầm chốt ngân sách/model.
- Chủ dự án đã yêu cầu tiếp tục bước tiếp theo; được bắt đầu P02 sau cổng P01, giữ giới hạn một phase sản phẩm.

## P02 — 2026-11-17

Thực hiện luồng luyện tổng hợp trong phạm vi plan: Drizzle/SQL migration theo ADR-0005 đề xuất, Zod, PostgreSQL local, user dev có chốt production. Không suy ra các ADR PROPOSED khác đã được owner duyệt toàn bộ. Tài liệu P01/nguồn riêng không trở thành seed. Mode mock, import, auth thật và AI adapter chưa làm.

- P02 gate VERIFIED: CI f771a7b/run44133096057 success với PostgreSQL thật, 3 unit/7 integration/2 E2E, build và security checks. P02 DONE, PR #3 draft; chưa merge/deploy hoặc mở P03.

## P03 — 2026-11-18

- CHAT-10 CONFIRMED: chủ dự án chọn “Một nhóm/lớp được mời”, Google; Q3 đã giải quyết, ADR-0008 Accepted phạm vi/provider. Quyền dùng giáo trình P01 vẫn chỉ cá nhân, không tự mở rộng cho lớp.
- Stable next-auth4.24.15 cho Next16/React19, session DB revoke + JWT cookie, allowlist email exact. Google OAuth client riêng website chưa được cấu hình nên chưa có live verification. Không yêu cầu cookie NotebookLM hay API key ChatGPT Pro.
- App/migration DB credential tách riêng; provider thử chỉ nonproduction. Advisory picomatch được hardening có regression và báo raw counts, không ignore high chung. Hosting tiếp tục local, không P04.

- P03-CI VERIFIED: a4fc5f9/run44165851119 SUCCESS (https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44165851119); PR #4 draft, không merge/deploy. Test provider đạt không thay Google live; P03 còn cổng cấu hình/kiểm callback thật.

## CR-0001 — 2026-11-18

Chủ dự án yêu cầu “đánh giá rủi ro và thực hiện các thay đổi được đề xuất”. Accepted phần hardening dữ liệu/queries/tests/config/docs. Quy tắc seal và loopback DEV_HOST được áp dụng theo CR. Bản gốc đính kèm giữ làm tham chiếu; diễn giải thực thi ở ADR-0012. Không có lựa chọn mới cho by_topic; không merge PR/deploy (phần merge trong CR mâu thuẫn prompt cuối và quyết định giữ draft hiện có).

Repo đã có P03: nhánh phase-02-hardening dựa phase-03 để bảo toàn auth, migration mới0003, không sửa0001/0002. CI phase-03 superset được mở cho phase-* thay vì chạy lại job P02 dùng credential bootstrap cũ. Tests dùng maintenance transaction rollback thay vì DISABLE TRIGGER. Bản plan0.1 giữ nguyên; phụ lục0.2 ghi tiền điều kiện CR.

## Đợt sửa P1 — 2026-11-18

Chủ dự án yêu cầu “sửa mục1 trước đi”, thực hiện đợt1 trong kế hoạch review gồm RV-01/RV-02. Chọn unique expression index kiểm ngay để PostgreSQL arbitrate concurrent writes, không đổi schema nội dung khác hoặc hạ guard production. Các P2/P3 còn OPEN, không merge/deploy.

## Đợt2 — 2026-11-18

User yêu cầu sửa logout/quota/UI/provision/audit/recorder. Thực hiện RV-03..08, RV-13, RV-15 theo kế hoạch review. Giữ auth provider/allowlist và CSRF; wrapper bảo đảm durable revoke trước khi trả response logout. Quota client dựa signed cookie, không tin X-Forwarded-For; signed logout tách global cap. Không tự sửa seal/cycle/topic rendering/taxonomy/result/evaluator của đợt3, không merge/deploy.

## Đợt3 — 2026-11-18

Sau đợt2, user yêu cầu bước tiếp theo Plan; thực hiện đợt3 của kế hoạch review RV-09/10/11/12/14/16. Không coi là mở P04 vì Google live P03 vẫn chưa được xác minh. Dùng lại đội đã được user lập để triển khai/kiểm các phần độc lập, không tạo agent mới.

Snapshot topic mới cố định tại tạo attempt; attempt chưa nộp có sẵn chỉ backfill từ taxonomy hiện tại lúc migration, không giả định đó là dữ liệu lúc tạo. Kết quả submitted giữ nguyên. Seal legacy chỉ backfill phần lịch sử có bằng chứng hiện tại, không tự khóa draft chưa dùng hoặc bịa lịch sử đã rewind trước migration. Quy tắc multi-topic vẫn tính mỗi topic như hiện tại, không tự chọn chủ đề chính.

## P04 — 2026-11-19

User yêu cầu trực tiếp “làm PO4 đi”, cho phép thực hiện vòng đời nội dung local sau đợt hardening. Quyết định này cập nhật hạn chế mở P04 trong các mục lịch sử; Google live P03 vẫn pending riêng, không ghi đã kiểm OAuth thật. Không mở P05/AI pipeline, merge hay deploy.

Bundle profile1 là JSON MCQ, default5MiB/configurable50MiB thay ngưỡng50MB PROPOSED để giới hạn bộ nhớ local. SVG theo allowlist hình học; raster decode/reencode bằng sharp, XML parse bằng saxes. Tài sản lưu private DB cho local, không cấu hình object storage/hosting mới. Chỉ nguồn có quyền chia sẻ đúng đối tượng mới được duyệt; quyền cá nhân P01 không mở rộng cho lớp.
