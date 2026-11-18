# Trạng thái triển khai

Cập nhật: 2026-11-18 (Asia/Saigon). P03 đã triển khai, CI đạt, còn kiểm Google thật. Không triển khai production.

| Phase | Trạng thái                        | Bằng chứng / còn lại                                                                                                               |
| ----- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| P00   | DONE                              | Next.js/pnpm/TS strict, PostgreSQL ghim digest; CI run 43074691952; PR #1 draft                                                    |
| P01   | DONE — phạm vi spike/local        | 15 observation trên 12/11, 13/11, 17/11; owner duyệt grounding/điều khoản; ADR-0006 local và ADR-0007 OpenAI theo quyết định đã có |
| P02   | DONE                              | 10 câu tổng hợp, API-01..06, PostgreSQL, UI; local và CI run 44133096057 đạt                                                       |
| P03   | IMPLEMENTED — LIVE GOOGLE PENDING | T01–T06 có code; local unit104/integration14/E2E8 đạt với test provider; CI44165851119 đạt; chờ Google OAuth thật                  |
| P04   | NOT STARTED                       | Sau P03                                                                                                                            |
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

## Đợt sửa P1 — RV-01/RV-02 — IN PROGRESS

Ngày 2026-11-18, user yêu cầu sửa mục1 của kế hoạch review. Branch fix-review-p1 kế thừa review-current-code. Chỉ xử lý hai P1, không mở các mục P2/P3 hoặc P04.

- RV-02: migration0004 thêm unique index `(revision_id, lower(btrim(text)))`, không sửa migration cũ. Kiểm ngược trước migration: ca hai writer commit đỏ như dự kiến, ca writer rollback xanh. Sau migration: cả hai ca và10test integrity đều đạt (12/12). Writer thứ hai nhận23505 khi writer đầu commit; nếu writer đầu rollback thì writer thứ hai ghi được, dữ liệu vẫn đủ4text khác nhau.
- Migration/seed/migration rerun đạt trên DB thử verified của CR, không đổi DB P02/P03 gốc. Unique index kiểm ngay, không hỗ trợ đổi chéo hai text bằng các bước tạm trùng; dùng text trung gian hoặc revision mới. Text dài chịu giới hạn B-tree PostgreSQL: nếu vượt, DB từ chối ghi thay vì bỏ kiểm uniqueness.
- RV-01: job main có AUTH_MODE=disabled và APP_ORIGIN=http://127.0.0.1:3000. Probe đọc đúng hai env từ YAML, khởi động launcher production trên bundle đã build trước đó (appcode không đổi), override PORT3199 để bảo toàn server3000; GET health trả200 đúng payload. Server probe đã dừng. Không claim đã chạy workflow main trên GitHub; chờ CI branch cho code cuối.
