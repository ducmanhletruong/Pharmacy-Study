# Bàn giao

## Trạng thái mới nhất

- Ngày: 2026-11-12 (Asia/Saigon).
- Dự án local: `/workspace/web-starter`; nhánh hiện tại `phase-01`, dựa trên `phase-00`.
- P00 đã hoàn thành; CI cuối P00 trên commit `44848b1` thành công: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43075284113 . PR #1 còn draft, không tự merge.
- **P01 đã triển khai phần độc lập nhưng chưa đạt cổng toàn phase.** P02 và phase khác chưa bắt đầu.

## Quyết định mới từ chủ dự án

- Cho thực thi tiếp.
- Cho dùng MCP bên thứ ba; NotebookLM là tài khoản cá nhân và người dùng báo đã kết nối Codex.
- Dùng OpenAI/ChatGPT Pro của tài khoản hiện có cho AI. Hosting giai đoạn hiện tại đã chốt local, chưa production theo ADR-0011; còn quyền API/plan cụ thể của ứng dụng.

## Đã làm P01

- RDKit JS/WASM: dựng 10 cấu trúc tổng hợp; SVG giống hash qua hai tiến trình, đo thời gian/kích thước và xử lý SMILES lỗi. Report thật ở `spikes/chem-render/report.json`.
- NotebookLM: runbook kết nối, mẫu hồ sơ riêng tư, validator năm chủ đề qua ba ngày; 4 test của validator đạt. Template trống bị từ chối đúng exit 2.
- Hosting: ADR-0009 so sánh local, Render + Neon preview free và paid; nguồn chính thức, hạn chế cold start/backup và phần chưa quyết định.
- OpenAI: ADR-0010 phân biệt dùng tài khoản hiện có, SIWC/plan usage và API credits Pro nếu đủ điều kiện; chưa gọi API hoặc thay billing.
- LLM evaluator offline: 5 fixture tổng hợp có nhãn năm môn, prompt export, kiểm đáp án/citation và 2 test các ca từ chối. Reference self-check 5/5 không phải model evaluation.
- Workflow kiểm thử riêng công cụ P01; không rebuild Next.js vì không đổi code sản phẩm.

## Kết nối NotebookLM — phạm vi quan sát

Chat Cloud hiện không được cấp tool NotebookLM; plugin search rỗng; `codex mcp list --json` trong executor trả 0 server. Không kết luận kết nối của chủ dự án không tồn tại; chưa biết nó nằm ở máy/transport nào. Không đọc hoặc chuyển credential từ máy của người dùng.

Bước thực tế tiếp theo: chạy `docs/spikes/notebooklm-access.md` tại nơi MCP đã callable, hoặc cấp kết nối cho Cloud qua settings. Cần năm chủ đề với nguồn/vị trí thật trên ba ngày. Không thể thay ba ngày bằng nhiều lần chạy trong một ngày.

## Lệnh chạy spike

```bash
npm --prefix spikes ci --ignore-scripts --no-audit --no-fund
npm --prefix spikes run chem:render
node --test spikes/notebooklm/validate.test.mjs spikes/llm-eval/evaluate.test.mjs
node spikes/llm-eval/run.mjs
node spikes/llm-eval/run.mjs --prompts
```

Trong Cloud thêm `--cache /workspace/.npm-cache` cho npm ci nếu home không ghi được. Dependency spike tách khỏi app. Report RDKit có timestamp/timing thực, chạy lại cập nhật file này; SVG output bị Git ignore. Không commit source riêng, model output, cookie hoặc token.

## Phần còn thiếu / giới hạn

P01-T01 chờ live MCP và bằng chứng ba ngày; P01-T03 đã chốt local cho giai đoạn hiện tại, production hoãn; P01-T04 chờ cách cấp quyền OpenAI và batch model thật. Chi tiết ở `docs/blockers.md`, `docs/status.md`, `docs/decision-register.md`.

Ưu tiên local và dùng tài khoản Pro không tự chứng minh API credits đã active hoặc token app đã được cấp. Có thể tạo prompt để chạy tại nơi được phép dùng tài khoản rồi nhập output vào evaluator; bước này chưa phải API adapter P06. Không tự claim credit, chọn model trả phí, auto-recharge hoặc tạo hosting.

## Bảo toàn và phát sinh

App Next.js/DB/dependency workspace/plan gốc và AGENTS không đổi trong P01. Giữ server/DB đang có; không restart hoặc mở thêm. Starter Vite vẫn tham chiếu được qua `39ffc0b`/`baseline-vite`. P01 không merge mã sản phẩm; lịch sử phát sinh trong `worked.md`.

## PR và bằng chứng CI P01

PR nháp P01: https://github.com/ducmanhletruong/Pharmacy-Study/pull/2, base phase-00 (xếp chồng PR #1). CI công cụ spike trên commit 3c5f761 đã success: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43078944161 . Chỉnh tiếp theo chỉ nới điều kiện ngày về đúng plan; cần lấy kết quả CI của commit mới trước khi báo CI mới đạt.

## Cập nhật cuối theo trả lời hosting

Chủ dự án chọn tiếp tục local, chưa triển khai production; ADR-0011 Accepted và không cấp tài nguyên hosting. P01 vẫn chờ live NotebookLM/ba ngày và quyền OpenAI/model run; không dùng quyết định local để tự tuyên bố production hosting đã chốt.

CI cuối cho code công cụ `2e8a5d6` đã success: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43079292723 . Tổng cộng 6 test (4 NotebookLM + 2 evaluator); RDKit, self-check và template-rejection cũng pass. Những thay đổi sau chỉ là tài liệu quyết định này, không cần chạy lại test/build. PR #2 còn draft; không tự merge.
