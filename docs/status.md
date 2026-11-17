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

## CR-0001 — IN PROGRESS

Được giao đánh giá rủi ro và thực hiện18/11. Nhánh phase-02-hardening base phase-03, migration0003; không rollback P03. ADR-0012 và phụ lục plan0.2 ghi thiết kế/điều chỉnh tương thích. Cần đo migration/tests/query-count/CI trước báo DONE. Không merge/deploy hoặc chọn by_topic mới.

CR DB: kiểm ngược trước0003 có6/7 test đỏ,1test unique-index cũ xanh; migration từ chối data sai với23514 và rollback. DB verified rỗng migrate/seed/rerun đạt,7test gốc CR đạt; DB upgrade riêng seed bằng code P02 cũ rồi áp0003/seed mới đạt. Không động DB P02/P03 hiện có.
