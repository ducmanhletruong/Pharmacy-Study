# Trạng thái triển khai

Cập nhật: 2026-11-12 (Asia/Saigon). Phase hiện tại: P01 — PARTIAL / BLOCKED tại cổng tích hợp. P00 đã DONE; các phase sau P01 chưa bắt đầu.

| Task    | Trạng thái | Bằng chứng / còn lại                                                               |
| ------- | ---------- | ---------------------------------------------------------------------------------- |
| P00-T01 | DONE       | Workspace pnpm 11.25.0 và strict TypeScript; frozen install đạt trên clone sạch/CI |
| P00-T02 | DONE       | ESLint, Prettier và typecheck đạt trên local/clone sạch/CI                         |
| P00-T03 | DONE       | Vitest 5.1.0: smoke test health contract 1/1 đạt trên local/clone sạch/CI          |
| P00-T04 | DONE       | PostgreSQL 17.11 ghim digest, Compose và CI service healthy                        |
| P00-T05 | DONE       | Plan, 8 ADR, register/status/blockers/CR, AGENTS và báo cáo đã có; OPEN giữ nguyên |
| P00-T06 | DONE       | GitHub Actions run 43074691952 success; PR #1 draft                                |
| P00-T07 | DONE       | Build và HTTP production health/homepage đạt; dev server cổng 3000                 |

## Bảng phase

| Phase | Trạng thái        | Điều kiện trước khi bắt đầu                                                       |
| ----- | ----------------- | --------------------------------------------------------------------------------- |
| P00   | DONE              | Local, clean clone và GitHub Actions P00 đều pass; PR #1 đang draft, chưa merge   |
| P01   | PARTIAL / BLOCKED | Windows list thành công; còn kiến thức/citation ba ngày và quyết định/tích hợp AI |
| P02   | NOT STARTED       | P00 xong, duyệt tài liệu; Q4 mặc định A-03                                        |
| P03   | NOT STARTED       | P02 và Q3                                                                         |
| P04   | NOT STARTED       | P03                                                                               |
| P05   | NOT STARTED       | P04 và Q2                                                                         |
| P06   | NOT STARTED       | P04, P01, Q1, Q5, Q6                                                              |
| P07   | NOT STARTED       | P04 và Q2                                                                         |
| P08   | NOT STARTED       | P04, P01-T02 và Q2                                                                |
| P09   | NOT STARTED       | P04 và hình có giấy phép                                                          |
| P10   | NOT STARTED       | P06, P07, P08, P09, Q2 và taxonomy                                                |
| P11   | NOT STARTED       | P05 và P10                                                                        |
| P12   | NOT STARTED       | P11, ADR-0006 và điều kiện phát hành                                              |

## Kiểm chứng thực tế

Code được kiểm chứng tại commit `50403d8f7898a8de48c827f3521f172077584cb3`. Bổ sung sau commit này chỉ là tài liệu và hướng dẫn agent do Next.js sinh, không đổi code ứng dụng/dependency/build config.

| Môi trường                               | Kiểm tra                                                                                                               | Kết quả                                                                  |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Checkout làm việc                        | Install, lint, strict typecheck, Vitest 1/1, production build                                                          | PASS                                                                     |
| Local PostgreSQL                         | Compose up --wait, pg_isready, SHOW server_version                                                                     | PASS — 17.11, image ghim digest                                          |
| HTTP production                          | /api/v1/health HTTP 200 và JSON chính xác; homepage có tên dự án và lang=vi                                            | PASS                                                                     |
| Clone sạch /tmp/pharmacy-study-p00-clean | pnpm install --frozen-lockfile, lint, typecheck, test, build, format:check                                             | PASS; chỉ dùng chung cache package, không tái sử dụng node_modules/.next |
| GitHub Actions                           | Frozen install, lint, format, typecheck, unit smoke, build, production HTTP health, gitleaks; Postgres service healthy | PASS — run 43074691952                                                   |
| Secret scan                              | Gitleaks 8.30.1 local và CI                                                                                            | PASS — không phát hiện secret                                            |
| Plan gốc                                 | cmp với upload mới nhất                                                                                                | Trùng byte, không tự thay đổi bản v0.1 DRAFT                             |

Bằng chứng CI: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43074691952

PR: https://github.com/ducmanhletruong/Pharmacy-Study/pull/1 (draft, chưa merge).

Bản tool đã kiểm: Node.js 24.22.1, pnpm 11.25.0, Next.js 16.4.6, React 19.3.1, TypeScript 6.0.3, ESLint 9.39.5 (thỏa peer của plugin Next.js), Vitest 5.1.0, PostgreSQL 17.11.

Lượt format check đầu phát hiện cách xuống dòng mảng healthcheck của Compose; đã format đúng file và clone sạch/CI xác nhận pass. Lượt install đầu lỗi quyền ghi home và lượt offline thiếu metadata không được coi là đạt; kết quả cuối đã thay thế chúng bằng install thành công có kiểm tra supply-chain.

Không chạy browser e2e, migration, auth, pipeline AI hoặc test nghiệp vụ ở P00 vì chúng chưa được thiết lập; không báo đạt các cổng MVP chưa tồn tại. Không triển khai production hoặc tự merge PR.

## P01 — Khảo sát khả thi

Lệnh “thực thi tiếp” của chủ dự án đã cho phép tiếp tục. Không bắt đầu P02 hoặc sửa code sản phẩm trong lượt này.

| Task    | Trạng thái                        | Bằng chứng / còn thiếu                                                                                                                  |
| ------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| P01-T01 | WINDOWS LIST OK / CAPTURE PENDING | Chủ dự án xác nhận 47 notebook và quyền dùng cá nhân; recorder/handoff Windows đã có; chưa có kiến thức/citation ba ngày                |
| P01-T02 | DONE                              | RDKit 2026.09.2: 10 SVG tái lập trong hai process, SMILES lỗi bị từ chối, timing/hash có report                                         |
| P01-T03 | DONE — CURRENT STAGE              | ADR-0011 Accepted: tiếp tục local; production hosting hoãn, ADR-0006 vẫn OPEN                                                           |
| P01-T04 | EXPLORATORY OUTPUT EVALUATED      | 5 output Codex trong chat đạt kiểm tra cơ học trên nguồn tổng hợp; model/version, API/plan grant và chất lượng chuyên môn chưa xác minh |

### Kiểm chứng P01

- RDKit spike đã chạy thành công bằng dependency chính thức, ghim version/integrity trong lockfile riêng.
- Validator NotebookLM: 4 unit test đạt, gồm các ca thiếu citation, lặp một ngày, tương lai và quyền nguồn chưa xác nhận.
- Evaluator LLM: 2 unit test đạt; reference self-check đạt 5/5, có nhãn không phải inference. Bổ sung từ chối citation giả thêm vào danh sách và kiểm lại evaluator.
- Template NotebookLM trống bị từ chối với exit 2 như mong đợi; không báo kết nối thành công.
- ESLint chỉ trên spikes đạt. Chỉ format file mới/thay đổi, không format toàn repo.
- Workflow `phase-01.yml` kiểm công cụ spike với Node/native tests và npm lockfile riêng. CI của spike chỉ chứng minh công cụ chạy được, không chứng minh live NotebookLM, quyền nguồn, chất lượng model hay provider entitlement. Kết quả CI thực tế ghi trong PR khi có.
- Không build/test lại Next.js: không có thay đổi app, dependency workspace, DB schema hoặc build config của sản phẩm.

### Kết quả Windows — 2026-11-12

Chủ dự án cung cấp kết quả notebook_list thành công (47 notebook, chỉ đọc) tại Windows; đã đối chiếu lịch sử call của chat local. Quyền nguồn năm notebook cho cá nhân, không công khai giáo trình, đã được xác nhận. Có recorder tự tính hash/lưu lịch sử và handoff Windows sẵn để chạy; chưa có observation kiến thức thật. Không sửa report Cloud thành pass. Còn thiếu kiến thức/citation cho cùng năm chủ đề trên ba ngày; P01 vẫn PARTIAL / BLOCKED.

Code spike ở commit `0dc5d96fbf774c764abd0b0063503b5dcd796f42` đã qua CI [run 43157607324](https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43157607324): 11 test Node (4 validator, 5 recorder, 2 evaluator), 4 test Python, RDKit hai process, reference self-check và từ chối template trống. Không gọi tài khoản NotebookLM hoặc API AI trong CI. Bổ sung sau commit này chỉ là tài liệu ghi kết quả/hướng dẫn, không thay đổi code đã kiểm.

### Cổng chưa đạt

Còn thiếu hồ sơ kiến thức/citation cho năm chủ đề trên ba ngày; Windows list đã thành công theo chủ dự án, Cloud chưa có account auth riêng. Đường truy cập OpenAI cần chốt/thiết lập thực tế; hosting giai đoạn hiện tại đã chọn local theo ADR-0011, production còn hoãn. P01 chưa DONE. ADR-0006/0007 chưa chuyển Accepted; các hồ sơ bổ sung không tự thay thế quyết định của chủ dự án.

## Phạm vi kết thúc

Chỉ P01. Tiếp tục bước còn thiếu khi có thông tin/credential được cấu hình qua settings hoặc hồ sơ chạy local. Không tự vượt sang phase sản phẩm hoặc dùng dữ liệu mẫu để làm giả bằng chứng live.

## Ranh giới commit P01

- P01-T01: công cụ và runbook đã chuẩn bị; phần live vẫn blocked.
- P01-T02: RDKit Node/WASM đã kiểm chứng 10 cấu trúc, report và dependency cô lập.
- P01-T03: hồ sơ và quyết định tiếp tục local đã có; production được hoãn theo lựa chọn chủ dự án.
- P01-T04: hồ sơ OpenAI/Pro, evaluator và năm output sinh trong chat đã có; chưa xác minh model/version, API/plan grant hoặc chất lượng chuyên môn.

### Bổ sung rà soát P01

PR nháp #2: https://github.com/ducmanhletruong/Pharmacy-Study/pull/2 . CI spike đã success trên commit 3c5f761, run 43078944161. Điều kiện live vẫn blocked. Rà lại P01-T01 cho thấy plan chỉ yêu cầu ổn định qua ba ngày, không bắt buộc liên tiếp; đã sửa validator/runbook để nhận ba ngày khác nhau và thêm test cho khoảng cách ngày. Không tự thêm điều kiện sản phẩm.

### Quyết định local và CI cuối

Chủ dự án chọn tiếp tục local, chưa triển khai production: ADR-0011 Accepted, không cấp tài nguyên mới. T03 hoàn thành hồ sơ và quyết định cho giai đoạn hiện tại; không tự coi ADR-0006 production đã Accepted. P01 tổng thể vẫn PARTIAL/BLOCKED.

CI công cụ trên commit `2e8a5d61d1589edda392988143fcf602ba40497d` đã **success**, gồm 6 test, RDKit hai process, reference self-check và từ chối template trống: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43079292723 . Bổ sung sau commit này chỉ là tài liệu quyết định local, không đổi công cụ/app/dependency.

### Ưu tiên nối MCP NotebookLM

Đã cài MCP CLI 0.16.2 cô lập ngoài repo và đăng ký `pharmacy-notebooklm` vào Codex của executor, chỉ bật notebook_list/notebook_get. Bắt tay MCP thật và catalog 55 tool đạt; probe read-only tới notebook_list trả thiếu xác thực, dù isError=false. Bốn test classifier ngăn false-positive đã pass; báo cáo metadata trong spikes/notebooklm/connection-report.json.

Phiên browser auth đã mở nhờ DISPLAY/XAUTHORITY đúng của Desktop; chưa được đăng nhập trong 300 giây và đã timeout/đóng. Cần chủ dự án đăng nhập Google khi sẵn sàng. Không có credential, notebook title/ID hoặc nguồn riêng được commit. CLI registration không tự chứng minh native tools đã hot-load vào chat hiện tại. P01 vẫn chưa đạt live gate.
