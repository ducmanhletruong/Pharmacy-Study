# Bàn giao P04

Worktree `/workspace/pharmacy-study-cr0001`, branch `phase-04`, base `fix-review-data-completion`.
Trạng thái và bằng chứng duy nhất: [docs/status.md](docs/status.md).
User đã yêu cầu trực tiếp P04; Google live P03 vẫn pending riêng.
Scope: bundle/import, sources/assets, lifecycle, admin review/edit và learner reports.
Migration0007 đã áp DB verified; không sửa checksum hoặc tắt trigger.
Nguồn/giáo trình thật chưa nhập; fixtures hoàn toàn tổng hợp.
Runbook: [content review](docs/runbooks/content-review.md), [bundle format](docs/bundle-format.md).

```sh
pnpm db:migrate
pnpm content:validate content/fixtures/p04-bundle.json
pnpm dev
```

Dùng pnpm store hiện có `/workspace/web-starter/.pnpm-store` ở Cloud.
Admin mở `/admin`; duyệt nguồn trước verified → approved.
Sửa tạo revision mới, report/source rejection quarantine; bài cũ giữ revision.
Ảnh cùng hash khác provenance trả409; không vượt gate bằng SQL sửa lịch sử.
Thu hồi import dùng transaction maintenance có review trong runbook.
Đang chốt E2E và CI; xem status trước khi tiếp tục.
Không merge/deploy, công khai giáo trình hoặc tự bắt đầu P05.
