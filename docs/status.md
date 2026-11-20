# Trạng thái triển khai

Cập nhật: 2026-11-18 (Asia/Saigon). P03 đã triển khai, CI đạt, còn kiểm Google thật. Không triển khai production.

| Phase | Trạng thái                        | Bằng chứng / còn lại                                                                                                               |
| ----- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| P00   | DONE                              | Next.js/pnpm/TS strict, PostgreSQL ghim digest; CI run 43074691952; PR #1 draft                                                    |
| P01   | DONE — phạm vi spike/local        | 15 observation trên 12/11, 13/11, 17/11; owner duyệt grounding/điều khoản; ADR-0006 local và ADR-0007 OpenAI theo quyết định đã có |
| P02   | DONE                              | 10 câu tổng hợp, API-01..06, PostgreSQL, UI; local và CI run 44133096057 đạt                                                       |
| P03   | IMPLEMENTED — LIVE GOOGLE PENDING | T01–T06 có code; local unit104/integration14/E2E8 đạt với test provider; CI44165851119 đạt; chờ Google OAuth thật                  |
| P04   | DONE — local workflow             | T01–T06 và AC-6 đạt; CI44437310878; PR #9 draft; Google live P03 vẫn pending riêng                                                 |
| P05   | NOT STARTED                       | Sau P04, Q2                                                                                                                        |
| P06   | NOT STARTED                       | Sau P04/P01; đường cấp quyền AI, Q6 và adapter còn phải xác minh                                                                   |
| P07   | NOT STARTED                       | Sau P04, Q2                                                                                                                        |
| P08   | NOT STARTED                       | Sau P04; RDKit spike đã đạt, Q2                                                                                                    |
| P09   | NOT STARTED                       | Sau P04 và quyền hình ảnh                                                                                                          |
| P10   | NOT STARTED                       | Sau P06/P07/P08/P09, taxonomy và Q2                                                                                                |
| P11   | NOT STARTED                       | Sau P05/P10                                                                                                                        |
| P12   | NOT STARTED                       | Sau P11 và quyết định hosting/phát hành                                                                                            |

## Tasks P02

| Task    | Trạng thái | Kết quả                                                                                                      |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------ |
| P02-T01 | DONE       | SQL migration 0001, 9 bảng, FK revision-owner, index/constraints; migration rỗng và chạy lại đạt             |
| P02-T02 | DONE       | 1 môn tổng hợp, cây chủ đề, 10 MCQ; seed lặp không nhân bản hoặc xóa attempts                                |
| P02-T03 | DONE       | Chấm MCQ theo label, đủ A/B/C/D và đúng một đáp án; 2 test grading đạt                                       |
| P02-T04 | DONE       | API-01..06, contract Zod, Origin, ownership, idempotency, revision snapshot; 7 integration/contract test đạt |
| P02-T05 | DONE       | UI chọn môn/chủ đề, lưu từng câu, giải thích/nguồn, kết quả; KaTeX và responsive                             |
| P02-T06 | DONE       | 2 Chromium E2E đạt local/CI: 10 câu, reload/resume, kết quả và mobile 390px                                  |

## Kiểm chứng P02 local

- Frozen P00 install và install dependency P02 đạt; không nâng Node/pnpm/Next/React/TS.
- PostgreSQL 17.11 healthy từ Compose; db:migrate/db:seed trên DB rỗng và chạy lại đạt. Không tác động DB Windows.
- Unit 3/3 (2 grading + 1 health), integration/contract 7/7; kiểm không lộ đáp án, concurrent idempotency/answers, Origin, ownership, điểm, submit lặp, pin revision.
- E2E 2/2, đã quan sát screenshot desktop/mobile. Chỉ kiểm Chromium/viewport, không nhận là đã kiểm mọi browser hoặc thiết bị vật lý.
- Next production build đạt; production launcher từ chối AUTH_MODE=dev trước khi mở server, kiểm process exit 0 của test guard đạt.
- Audit không có high/critical, có 1 moderate minimatch trong toolchain; không tự nâng dependency nền ngoài phạm vi.
- Lint/format, checksum report và diff check ghi trong worked.md; CI và kiểm tra code mới đã đạt theo run ở phần cổng phía dưới.

## Bằng chứng P01

Owner xác nhận “Đã review và duyệt cả grounding lẫn điều khoản” ngày 17/11. Lịch sử chat Windows báo recorder exit 0, 15 observation đủ năm chủ đề trên ba ngày; Cloud không đọc raw nguồn/private capture hoặc tự chạy lại validator. Hai pending cũ đã được xử lý ở Windows. Sự cố auth 13/11 khôi phục bằng refresh_auth, không chứng minh phiên vô thời hạn.

CI spike 0dc5d96 success: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43157607324 . Provider OpenAI đã được chọn; API entitlement/model/billing vẫn phải xác minh ở P06. Đính chính việc coi API app hoạt động là điều kiện P02 quá chặt so với mục P01 của plan. Hosting hiện tại local theo ADR-0011, production còn hoãn.

Plan upload giữ nguyên; phát sinh và lịch sử chi tiết ở worked.md. Không dùng nguồn giáo trình trong seed hoặc claim nội dung mẫu là đề thi thật.

## Cổng P02 đã đạt

CI code `f771a7bc11b8e52753fa068cad2bb8ad2e5ba115` SUCCESS: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44133096057 . Frozen install, lint/format, typecheck, migration DB rỗng và seed/rerun, unit3/integration7/E2E2, production build, startup guard, audit mức high và gitleaks đều success. PR #3: https://github.com/ducmanhletruong/Pharmacy-Study/pull/3 (draft, base phase-01).

Lượt sau CI chỉ cập nhật Markdown bàn giao/kết quả; không đổi code đã kiểm. P02 DONE, dừng cổng phase. Không tự mở P03 hoặc merge/deploy. Hướng dẫn chạy: docs/runbooks/local-practice.md.

## P03 — kiểm chứng và cổng còn lại

Q3 đã chốt lớp được mời, Google (ADR-0008). T01 auth/session, T02 authorize96 ô + default deny, T03 owner guard, T04 role DB/audit append-only, T05 Origin/CSP/nonce/rate limit, T06 auth E2E đã triển khai. Local đã đạt 104 unit, 14 integration, 8 E2E Chromium; production build và startup guard dev/test đạt. Callback Google thật chưa chạy do không có OAuth client; không báo P03 DONE trước kiểm này. CI phase-03 a4fc5f9/run44165851119 SUCCESS.

DB P03 riêng, runtime app_rw không có quyền DDL/sửa xóa audit; maintenance riêng. Advisory picomatch high được mitigation bằng patch có hash/regression, raw audit vẫn có high1 và moderate1; xem docs/security/dependency-hardening.md. Không mở P04, merge hoặc deploy. Runbook: docs/runbooks/google-login.md.

Kiểm cuối local: lint, format:check, git diff --check, unit104, security classifier4 và audit:security đạt. Provision rerun sau sửa env đạt, không in credential. CI chưa chạy tại thời điểm commit này.

CI code `a4fc5f973ca8ce808a48a4bde4072c31102d1caf` SUCCESS: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44165851119 . Frozen install/lint/format/types, migration/bootstrap/provision/seed-rerun, unit104/integration14/E2E8, build, production guard, dependency hardening gate và gitleaks đều đạt. PR #4 draft: https://github.com/ducmanhletruong/Pharmacy-Study/pull/4 . Bổ sung sau CI chỉ đổi Markdown; P03 vẫn LIVE GOOGLE PENDING, không mở P04.

## CR-0001 — DONE (phạm vi hardening đã duyệt)

Cập nhật 2026-11-18. Branch `phase-02-hardening`, base `phase-03`; giữ nguyên auth/roles P03 và migration đã chạy. Dùng migration `0003_integrity_hardening.sql`. Phạm vi/điều chỉnh từ CR gốc: ADR-0012 và phụ lục plan v0.2.

| Kiểm chứng              | Kết quả thực tế                                                                                                                |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Reverse trước migration | 6/7 test gốc CR đỏ; test unique-index có sẵn xanh                                                                              |
| Data cũ sai             | Migration từ chối với 23514; registry 0003 và cột mới đều count 0 sau rollback                                                 |
| DB rỗng                 | Migrate/provision/seed/rerun đạt ở CI                                                                                          |
| DB đã seed trước CR     | Nâng 0003 và seed mới đạt trên DB upgrade riêng                                                                                |
| Unit                    | 106/106 đạt                                                                                                                    |
| Integration             | 27/27 đạt, gồm 10 test integrity                                                                                               |
| Query-count             | Cả 1 và 10 câu đều 3 query tổng: owner, subject, items+choices; chỉ 1 query lấy items+choices; giữ thứ tự A/B/C/D và redaction |
| Chromium E2E            | 8/8 đạt; local dùng Chromium có sẵn, CI dùng Playwright Chromium                                                               |
| Build và startup guards | Production build đạt; dev/test bị từ chối ở production                                                                         |
| Chất lượng/bảo mật      | Lint, format, typecheck, dependency mitigation/audit gate và gitleaks đạt; local gitleaks 44 commit                            |

CI code `51f9eb29255b1ed4377ae0231ff199ea1240cc70` **SUCCESS**: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44168202855 . Trigger PR vào `phase-03` đã chạy thực tế. [PR #5](https://github.com/ducmanhletruong/Pharmacy-Study/pull/5) draft, chưa merge/deploy. Sau code đã kiểm chỉ bổ sung Markdown rủi ro/bàn giao; không chạy lại local tests/build cho tài liệu.

Quy tắc MCQ/seal/same-subject, query gộp, config pool/body/DEV_HOST/APP_ORIGIN, tests, docs và CI đã thực hiện. Không áp migration lên DB P02/P03 gốc hoặc Windows. Rủi ro vận hành còn lại: writer phải ghi revision và đủ choices trong transaction, nội dung sealed phải tạo revision mới, invalid legacy data phải được xử lý có review trước migration. Rollback vận hành dùng forward migration được review, không xóa registry hoặc volume.

Các mục CR đã hoãn vẫn giữ nguyên: lifecycle P04, tối ưu random theo ngưỡng, password guard P12, quyết định by_topic trước P05. Không merge các PR xếp chồng. P03 Google live vẫn pending riêng; CR DONE không đóng cổng P03 hoặc cho phép mở P04.

## Review độc lập — 2026-11-18

Review theo yêu cầu chủ dự án đã hoàn tất trên snapshot b53016d (P00–P03 + CR-0001), bằng đội sáu subagent và root đối chiếu. Báo cáo nguồn: [review code](reviews/2026-11-18-code-review.md), gồm bằng chứng, giới hạn, vị trí code và đề xuất theo mức ưu tiên. Các finding hiện **OPEN, chưa sửa**; đặc biệt cần xử lý lỗi CI main và write skew MCQ trước tích hợp/mở writer.

Không đổi lịch sử kết quả CI đã đo ở trên; review bổ sung các trường hợp test cũ chưa bao phủ, không suy từ CR DONE rằng các bảo đảm đều hoàn chỉnh. Không chạy lại full suite/build, không sửa logic/schema/config/dependency; probe dùng synthetic/rollback/fixture riêng, UI server riêng đã dừng. P03 Google live vẫn pending; không mở P04 hoặc merge/deploy.

## Đợt sửa P1 — RV-01/RV-02 — DONE

Ngày 2026-11-18, user yêu cầu sửa mục1 của kế hoạch review. Branch fix-review-p1 kế thừa review-current-code. Chỉ xử lý hai P1, không mở các mục P2/P3 hoặc P04.

- RV-02: migration0004 thêm unique index `(revision_id, lower(btrim(text)))`, không sửa migration cũ. Kiểm ngược trước migration: ca hai writer commit đỏ như dự kiến, ca writer rollback xanh. Sau migration: cả hai ca và10test integrity đều đạt (12/12). Writer thứ hai nhận23505 khi writer đầu commit; nếu writer đầu rollback thì writer thứ hai ghi được, dữ liệu vẫn đủ4text khác nhau.
- Migration/seed/migration rerun đạt trên DB thử verified của CR, không đổi DB P02/P03 gốc. Unique index kiểm ngay, không hỗ trợ đổi chéo hai text bằng các bước tạm trùng; dùng text trung gian hoặc revision mới. Text dài chịu giới hạn B-tree PostgreSQL: nếu vượt, DB từ chối ghi thay vì bỏ kiểm uniqueness.
- RV-01: job main có AUTH_MODE=disabled và APP_ORIGIN=http://127.0.0.1:3000. Probe đọc đúng hai env từ YAML, khởi động launcher production trên bundle đã build trước đó (appcode không đổi), override PORT3199 để bảo toàn server3000; GET health trả200 đúng payload. Server probe đã dừng. Không claim đã chạy workflow main trên GitHub; chờ CI branch cho code cuối.

CI nhánh code `b1d3c9ab00a5c97b8a0172ed2d04b74df14038a7` SUCCESS: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44225961205 . Frozen install/lint/format/typecheck, migrate-empty/provision/seed-rerun, unit106/integration29/E2E8, build, guard, dependency gate và secret scan đều đạt. PR #6 draft base phase-02-hardening: https://github.com/ducmanhletruong/Pharmacy-Study/pull/6 . RV-01/RV-02 đã sửa; các P2/P3 còn OPEN. Workflow main chưa chạy trực tiếp trên GitHub; startup với env của nó đã kiểm local. Bổ sung sau CI chỉ là Markdown, không đổi code đã kiểm. Không merge/deploy.

## Đợt 2 — phục hồi và bảo mật — DONE

Ngày 2026-11-18, nhánh fix-review-recovery-security kế thừa fix-review-p1. Phạm vi RV-03/04/05/06/07/08/13/15, không sửa các mục đợt3.

- Auth: wrapper chặn response xóa cookie/redirect nếu event revoke bị NextAuth nuốt lỗi; trả503 và UI cho retry. Giữ CSRF của thư viện. Signed session logout dùng quota riêng, không ăn global anonymous. Anonymous dùng cookie rate identity có HMAC (không dùng IP header),120/client/phút và global cap1200/phút. Cookie là rate identity, không xác thực người dùng; xóa cookie có thể đổi bucket, cần trusted-edge chống abuse ở hosting; global cap vẫn có thể chặn anonymous login khi flood, không chặn signed logout.
- UI: generation guard vô hiệu callback cũ khi reset/unmount/chuyển context; catalog tải độc lập với resume; lỗi có nút về bộ luyện. Logout kiểm status/redirect, không báo thu hồi thành công khi503 hoặc CSRF redirect.
- Provision: journal credential private được sync trước DDL; DDL transaction; probe credential existing trước grant, không đổi password existing; ghi maintenance env trước runtime env bằng atomic rename và file600; lỗi còn journal để retry. Temp env cũng thuộc pattern ignore .env.*. Lock stale phải kiểm tra không có CLI chạy trước khi xóa, không xóa journal bừa.
- Audit: validate numeric high/critical và consistency, từ chối malformed advisory/exit status không hợp lệ; giữ verifier patch/advisory exact. Recorder khóa cả read-append-rename, cleanup khi lỗi; stale lock fail rõ ràng, không tự reap.
- Kiểm local: unit112 đạt trước test deadline bổ sung, test deadline riêng1/1 đạt; auth/provision fault tests, rate cookie chống giả, identity sentinel denial đạt. Classifier5/5 và recorder6/6 đạt (5CLI concurrent giữ5records). E2E recovery4/4 và happy logout/cookie-reuse1/1 đạt, CSRF âm đúng. Typecheck, lint/format và provision local rerun đạt; audit raw high1/moderate1, verifier mitigation đạt. CI sẽ kiểm code cuối.
- UI E2E lượt đầu bị HMR reload lặp; đã dừng runner, xóa riêng cache .next/dev rồi kiểm lại thành công. Một assertion alert bị trùng Next route announcer đã sửa selector đúng app error; không nới hành vi. Không coi các lượt lỗi này là pass.

Đợt2 provision đã tách core có fault injection, lưu journal và ghi env atomic theo thứ tự maintenance→runtime; DDL rollback/IO failure retry giữ nguyên credential đã kiểm, không sửa role password.

Đợt2 tooling: classifier malformed-report negatives và recorder concurrent CLI test đã được nối vào CI nhánh, bao gồm PR base fix-*. Đang chờ kiểm chứng môi trường sạch trước đóng các finding đợt2.

CI code `9428b3d8408c887826753db98274eb1ccf13784f` SUCCESS: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44229307690 . Frozen install/lint/format/typecheck, migrate-empty/provision/seed rerun, unit113/integration29/E2E12, build production/guards, classifier5 và recorder6, dependency audit/mitigation gate và gitleaks đều đạt. PR #7 draft, base fix-review-p1: https://github.com/ducmanhletruong/Pharmacy-Study/pull/7 . Gitleaks local trước fixture test sửa cuối đã quét52commit, không có secret; CI kiểm code cuối cũng đạt.

Đã xử lý RV-03/04/05/06/07/08/13/15 theo phạm vi đợt2. Quota cookie/global có giới hạn được ghi trong runbook, không tuyên bố chốngDDoS. Còn OPEN: RV-09/10/11/12/14/16 cho đợt3 và Google live P03 riêng. Chỉ bổ sung Markdown sau CI, không đổi code đã kiểm hoặc chạy lại local test/build; chưa merge/deploy.

## Đợt3 — nền dữ liệu/nội dung — DONE

Nhánh fix-review-data-completion kế thừa đợt2. Scope RV-09/10/11/12/14/16, migration forward mới dự kiến0005, không sửa0001–4. Chưa đóng finding trước khi kiểm migration, concurrency, API/contract và UI. P03 Google live còn pending; P04 chưa mở.

Đợt3 DB local: migration0005 apply/seed/rerun đạt; upgradeprobe2legacyitems có originlegacy_backfill và submitted.result giữ nguyên. App không được INSERT/UPDATE ledger hoặc gọi mutator trực tiếp. Unit topic-tree1 và integration lịch sử7 đạt (RC23514/RR40001); full integration36/36 đạt, gồm concurrency choices cũ. Contract5/5 và evaluator7/7 đạt; 65cặp score và topic overlap vẫn hợp lệ. Đang chờ UI/fullCI trước đóng scope.

Đợt3 local cuối: unit119/119, integration36/36, E2Etopic-depth1/1 đạt; chọn leaf cấp4 gửi đúngID. Lint/format/diff đạt; evaluator7test và reference self-check5/5 không inference đã được agent kiểm. Một E2E selector getByLabel exact không tìm select vì label bao options: sửa sang role combobox theo accessible name và kiểm lại đạt, không đổi hành vi để nới test. CI code cuối/build còn chờ.

Đợt3 contract/evaluator/UI đã triển khai và kiểm local như trên; chờ CI môi trường sạch trước đóng các finding còn lại.

Rà soát cuối bổ sung case bulk INSERT2/3topic có cycle: cả hai đỏ trước sửa. Vì0005 đã áp, thêm forward0006, không đổi checksum0005. Sau0006 history-taxonomy9/9 đạt, RC/RR vẫn đúng, preflight graph cũ fail nếu cycle thay vì tự repair. Fullintegration đã đạt36 trước hai regression mới; CI cuối sẽ chạy38.

CI code `ce6791b723d9f2528a9ce54a1d71ec0df0a26129` SUCCESS: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44232623121 . Frozen install/lint/format/typecheck, emptyDB migrations0001–0006/provision/seed-rerun, unit119/integration38/E2E13, production build/guards, classifier5/recorder6/evaluator7 và reference self-check5/5, audit/mitigation gate và gitleaks đều đạt. PR #8 draft: https://github.com/ducmanhletruong/Pharmacy-Study/pull/8 (base fix-review-recovery-security).

RV-09/10/11/12/14/16 đã được xử lý theo scope; các finding của ba đợt review đều có bản sửa/kiểm chứng, không đồng nghĩa mọi lỗi tương lai đã bị loại bỏ. Giới hạn legacy và quota/hosting đã ghi runbooks. P03 Google live vẫn pending, P04 chưa bắt đầu. Bổ sung sau CI chỉ đổi Markdown; không merge/deploy hoặc chạy lại local tests/build cho tài liệu.

## P04 — vòng đời nội dung — 2026-11-19

Chủ dự án yêu cầu trực tiếp “làm PO4 đi”. Tiếp tục P04 local theo yêu cầu này trong khi Google OAuth thật của P03 vẫn chưa kiểm chứng; không coi P03 DONE, không thay provider Google hoặc mở P05. Cổng nội dung được kiểm bằng provider synthetic nonproduction.

| Task    | Trạng thái | Kết quả                                                                                  |
| ------- | ---------- | ---------------------------------------------------------------------------------------- |
| P04-T01 | DONE       | Migration0007, provenance/source/assets/imports/reports; gate nguồn, seal, quyền runtime |
| P04-T02 | DONE       | JSON bundle profile1, schema/references, content:validate, fixture synthetic             |
| P04-T03 | DONE       | Máy trạng thái, evidence nguồn/asset, quarantine                                         |
| P04-T04 | DONE       | Import/API13–14, transaction/idempotency/hash/pg_trgm, SVG/raster private                |
| P04-T05 | DONE       | Admin list/filter/detail/source review/status/edit revision, expected_version            |
| P04-T06 | DONE       | Báo lỗi có ownership, quarantine, admin resolution; bài cũ giữ revision                  |

Kiểm local: unit216/216, integration47/47, E2E P04 mục tiêu1/1 đạt. Lint/format/typecheck, CLI fixture và dependency audit gate đạt; audit raw moderate1/high0/critical0. Production build và startup guard dev/test đều đạt; HTTP size cap cũng chặn request thiếu/khai sai Content-Length. CI toàn bộ đã SUCCESS; P04 DONE trong phạm vi local workflow được user yêu cầu. Hướng dẫn: [content review](runbooks/content-review.md). Giới hạn: CLI chỉ kiểm cấu trúc, server kiểm bytes; ảnh cùng hash khác provenance bị409; resolve báo lỗi không tự approve; thu hồi import qua transaction maintenance có review, chưa có nút hàng loạt. Chỉ dữ liệu tổng hợp, không nhập giáo trình hoặc gọi AI/NotebookLM.

### Cổng P04 đã đạt

Code `d2140830b43acb6e4f8aeb1b5b7920f38d49c80b`: [CI44437310878 SUCCESS](https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44437310878). [PR #9](https://github.com/ducmanhletruong/Pharmacy-Study/pull/9) draft, base fix-review-data-completion. Job phase-03 hiện là superset có cả kiểm chứng P04, không thêm job trùng.

| Kiểm chứng                        | Kết quả                                                                                                                                                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cài đặt/chất lượng                | Frozen install, lint/format, TypeScript đạt                                                                                                                                    |
| DB mới và rerun                   | Migrations0001–0007, provision hai login, seed/migrate/seed đạt; runtime vẫn không DDL hoặc sửa/xóa audit                                                                      |
| Bundle/lifecycle/assets/HTTP unit | 216/216 đạt; nguồn thiếu/chưa duyệt không phát hành, SVG script và raster giả bị từ chối, request vượt cap trả413 dù thiếu/khai sai Content-Length                             |
| Integration/contract              | 47/47 đạt; import đồng thời/idempotent, exact dedup, near-duplicate warning, rollback lỗi giữa chừng, conflict version, ownership, quarantine, revision pin và fixture lịch sử |
| Chromium E2E                      | 14/14 đạt; gồm admin import/source review/verified/approved → learner practice/ảnh/report → loại khỏi bài mới, bài cũ đọc được; learner import403                              |
| Production                        | Build đạt; launcher từ chối AUTH_MODE=dev/test                                                                                                                                 |
| Bảo mật                           | Classifier/recorder/evaluator/reference self-check, dependency gate và secret scan đạt; không có high/critical chưa xử lý                                                      |

AC-6 và tiêu chí chấp nhận P04 đã đạt trên dữ liệu tổng hợp. P03 Google OAuth thật vẫn pending, không suy ra đã kiểm Google từ test provider. Không có giáo trình được nhập, AI/NotebookLM call, merge hoặc deploy. P05 chưa bắt đầu. Sau code đã kiểm chỉ cập nhật Markdown bàn giao/kết quả, không chạy lại local tests/build cho tài liệu.

## Thay đổi truy cập theo yêu cầu — 2026-11-19

Branch feat-open-access, base phase-04. User yêu cầu Google hoặc ẩn danh, bỏ whitelist người học. Code mở email Google đã xác minh, giữ ADMIN_EMAILS phân quyền quản trị; INVITED_EMAILS không dùng. Thêm guest identity/session riêng, guest-only mode, migration0008; không sửa migration đã áp. ADR-0008 và runbook cập nhật theo quyết định mới, không tự mở P05.

Local đạt:16 targeted unit auth/config/recovery/rate-client,8 integration auth/DB,12 Chromium E2E auth/guest/recovery và1 lượt guest-only riêng không có Google credentials/admin emails. Lint, TypeScript, format/diff đạt; migration0008 đã áp DB verified, giữ checksum0001–0007. CI toàn bộ đã SUCCESS; thay đổi truy cập DONE trong scope yêu cầu. Google OAuth thật chỉ kiểm callback bằng mock, chưa xác nhận live. Không đổi private env, không public tài liệu hoặc deploy.

### Cổng mở truy cập đã đạt

Code `9685363ba2f79fab123738bf7fdfb767c6f77173`: [CI44448319673 SUCCESS](https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44448319673). [PR #10](https://github.com/ducmanhletruong/Pharmacy-Study/pull/10) draft, base phase-04; chưa merge/deploy.

- Frozen install, lint/format, TypeScript và bundle validator đạt.
- Migrations0001–0008 trên DB rỗng, provision login runtime/maintenance, seed/migrate/seed rerun đạt.
- Unit222/222, integration48/48, Chromium E2E16/16 đạt.
- Guest-only E2E riêng1/1 đạt, không Google credentials/admin emails; provider duy nhất là guest. Kiểm CSRF, fake identity/role, tách bài giữa hai guest, reload/resume, admin403 và logout token replay.
- Production build/startup guards, classifier/recorder/evaluator, dependency gate và secret scan đạt.

Google verified callback được kiểm bằng mock, chưa kiểm OAuth Google thật. Phiên guest không đồng bộ/merge vào Google hoặc phục hồi sau logout/hết hạn/mất cookie; DB chưa có cleanup tự động. Không thay private env, nhập nội dung chuyên môn hoặc tự mở P05. Sau CI chỉ cập nhật Markdown kết quả/bàn giao, không chạy lại local tests/build cho tài liệu. Hướng dẫn cấu hình mới ở [runbook](runbooks/google-login.md).
