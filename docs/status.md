# Trạng thái triển khai

Cập nhật: 2026-11-12 (Asia/Saigon). Phase hiện tại: P00 — IN PROGRESS. Các phase khác chưa bắt đầu.

| Task    | Trạng thái     | Bằng chứng / còn lại                                                                            |
| ------- | -------------- | ----------------------------------------------------------------------------------------------- |
| P00-T01 | IMPLEMENTED    | Workspace pnpm 11.25.0, dependency ghim, TypeScript strict; install thành công, chờ clean clone |
| P00-T02 | VERIFIED LOCAL | ESLint và strict TypeScript đã pass; còn đối chiếu format/clean clone/CI                        |
| P00-T03 | VERIFIED LOCAL | Vitest 5.1.0: 1 health-contract smoke test pass; handler health được commit cùng test           |
| P00-T04 | VERIFIED LOCAL | PostgreSQL 17.11 image ghim digest; Compose up --wait và pg_isready healthy                     |
| P00-T05 | VERIFIED LOCAL | Plan gốc giữ nguyên; 8 ADR, register/status/blockers/CR và quy tắc phase đã đọc lại             |
| P00-T06 | IMPLEMENTED    | Workflow đã tạo; chờ PR và lần chạy GitHub Actions                                              |
| P00-T07 | IN PROGRESS    | App chỉ có tên dự án, GET /api/v1/health; chờ build và HTTP check                               |

## Bảng phase

| Phase | Trạng thái  | Điều kiện trước khi bắt đầu                |
| ----- | ----------- | ------------------------------------------ |
| P00   | IN PROGRESS | Kiểm chứng local, clean clone và CI xanh   |
| P01   | NOT STARTED | P00 xong, duyệt tài liệu, Q1 và Q5         |
| P02   | NOT STARTED | P00 xong, duyệt tài liệu; Q4 mặc định A-03 |
| P03   | NOT STARTED | P02 và Q3                                  |
| P04   | NOT STARTED | P03                                        |
| P05   | NOT STARTED | P04 và Q2                                  |
| P06   | NOT STARTED | P04, P01, Q1, Q5, Q6                       |
| P07   | NOT STARTED | P04 và Q2                                  |
| P08   | NOT STARTED | P04, P01-T02 và Q2                         |
| P09   | NOT STARTED | P04 và hình có giấy phép                   |
| P10   | NOT STARTED | P06, P07, P08, P09, Q2 và taxonomy         |
| P11   | NOT STARTED | P05 và P10                                 |
| P12   | NOT STARTED | P11, ADR-0006 và điều kiện phát hành       |

## Kiểm chứng thực tế

Chưa chạy kiểm chứng cho code P00. Không kế thừa kết quả kiểm tra starter Vite để báo đạt cho Next.js.

## Phạm vi kết thúc

Dừng ở cổng P00 theo mục 10.1. Không tự bắt đầu P01/P02. Cập nhật bằng chứng sau khi chạy, kể cả phần thất bại hoặc chưa xác minh.
