# Trạng thái triển khai

Cập nhật: 2026-11-12 (Asia/Saigon). Phase hiện tại: P00 — DONE. Các phase khác chưa bắt đầu.

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

| Phase | Trạng thái  | Điều kiện trước khi bắt đầu                                                     |
| ----- | ----------- | ------------------------------------------------------------------------------- |
| P00   | DONE        | Local, clean clone và GitHub Actions P00 đều pass; PR #1 đang draft, chưa merge |
| P01   | NOT STARTED | P00 xong, duyệt tài liệu, Q1 và Q5                                              |
| P02   | NOT STARTED | P00 xong, duyệt tài liệu; Q4 mặc định A-03                                      |
| P03   | NOT STARTED | P02 và Q3                                                                       |
| P04   | NOT STARTED | P03                                                                             |
| P05   | NOT STARTED | P04 và Q2                                                                       |
| P06   | NOT STARTED | P04, P01, Q1, Q5, Q6                                                            |
| P07   | NOT STARTED | P04 và Q2                                                                       |
| P08   | NOT STARTED | P04, P01-T02 và Q2                                                              |
| P09   | NOT STARTED | P04 và hình có giấy phép                                                        |
| P10   | NOT STARTED | P06, P07, P08, P09, Q2 và taxonomy                                              |
| P11   | NOT STARTED | P05 và P10                                                                      |
| P12   | NOT STARTED | P11, ADR-0006 và điều kiện phát hành                                            |

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

## Phạm vi kết thúc

Dừng ở cổng P00 theo mục 10.1. Không tự bắt đầu P01/P02. Cập nhật bằng chứng sau khi chạy, kể cả phần thất bại hoặc chưa xác minh.
