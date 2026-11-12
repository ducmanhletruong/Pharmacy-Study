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
- Đã thêm recorder nối observation/hash và [handoff Windows](docs/spikes/notebooklm-windows-handoff.md) chứa nội dung gửi vào chat local; script không gọi MCP hoặc tự đặt grounding. Chưa chạy batch kiến thức thật. Không tự gửi việc sang agent khác.
- Hosting: ADR-0009 so sánh local, Render + Neon preview free và paid; nguồn chính thức, hạn chế cold start/backup và phần chưa quyết định.
- OpenAI: ADR-0010 phân biệt dùng tài khoản hiện có, SIWC/plan usage và API credits Pro nếu đủ điều kiện; chưa gọi API hoặc thay billing.
- LLM evaluator offline: 5 fixture tổng hợp, prompt export, kiểm đáp án/citation và 2 test các ca từ chối. Ngoài reference self-check, đã nhập năm output do phiên Codex này sinh: 5/5 đạt trên nguồn tổng hợp. Report/candidates ở spikes/llm-eval/codex-session-*.json; đánh giá không mù, không phải kiểm kiến thức chuyên môn hoặc API entitlement. Model/version, usage/cost chưa xác minh, giữ null.
- Workflow kiểm thử riêng công cụ P01; không rebuild Next.js vì không đổi code sản phẩm.

## Kết nối NotebookLM — cập nhật mới nhất

- Ngày 2026-11-12 chủ dự án cung cấp kết quả từ Windows: notebook_list thành công, tài khoản có 47 notebook, chỉ đọc. Đã đối chiếu call hoàn thành trong turn mới nhất của đúng chat local; không phải call trực tiếp từ Cloud. Quyền dùng tài liệu năm notebook cho học tập cá nhân, không công khai giáo trình, đã được chủ dự án xác nhận. Tiếp tục P01-T01 bằng tay ở chat local “Kết nối Codex với NotebookLM”; không yêu cầu đăng nhập Cloud lại.
- Codex CLI trong Cloud đã được đăng ký server `pharmacy-notebooklm`; chỉ bật notebook_list/notebook_get. Cấu hình global hiện tại được giữ nguyên các mục khác; không sửa config trên máy riêng của người dùng.
- CLI package 0.16.2 ở `/workspace/.pharmacy-notebooklm/venv`; state riêng ở `/workspace/.pharmacy-notebooklm/state` (0700), profile pharmacy-personal. Không nằm trong Git.
- MCP initialize và list 55 tool thành công. Server reported version 4.1.8 là framework, không phải CLI package version.
- Lệnh notebook_list thật trả chưa có Google auth. Browser auth đã mở đúng trang NotebookLM nhưng timeout sau 300 giây, cửa sổ auth đã đóng; chưa có account session đã xác minh.
- Bước tiếp tại Windows: chủ dự án gửi đoạn giao việc trong docs/spikes/notebooklm-windows-handoff.md ở chat local đang có MCP. Xác định notebook/năm chủ đề thật, dùng căn cứ quyền nguồn đã xác nhận rồi lấy trích đoạn kèm vị trí nguồn; đối chiếu thật và dùng record.mjs nối capture riêng. Lặp cùng năm chủ đề trên ba ngày khác nhau. Cloud auth là phương án riêng chưa hoàn tất, không cần lặp lại hoặc copy credential Desktop.
- Cấu hình global CLI không tự hot-load tool vào chat hiện tại; probe SDK chạy trực tiếp là đường kiểm chứng đang dùng. Tài liệu đường Desktop/Secure MCP Tunnel trong docs/spikes/notebooklm-access.md.

Report đã lọc: spikes/notebooklm/connection-report.json. Không coi transport/catalog hoặc isError=false là xác thực account thành công. Cần dữ liệu năm chủ đề thật qua ba ngày sau khi đăng nhập.

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

P01-T01 đã có kết quả list Windows do chủ dự án cung cấp, còn chờ kiến thức/citation và bằng chứng ba ngày; P01-T03 đã chốt local cho giai đoạn hiện tại, production hoãn; P01-T04 đã có output thăm dò trong chat nhưng còn cách cấp quyền OpenAI, model định danh và đánh giá chuyên môn. Chi tiết ở `docs/blockers.md`, `docs/status.md`, `docs/decision-register.md`.

Ưu tiên local và dùng tài khoản Pro không tự chứng minh API credits đã active hoặc token app đã được cấp. Có thể tạo prompt để chạy tại nơi được phép dùng tài khoản rồi nhập output vào evaluator; bước này chưa phải API adapter P06. Không tự claim credit, chọn model trả phí, auto-recharge hoặc tạo hosting.

## Bảo toàn và phát sinh

App Next.js/DB/dependency workspace/plan gốc và AGENTS không đổi trong P01. Giữ server/DB đang có; không restart hoặc mở thêm. Starter Vite vẫn tham chiếu được qua `39ffc0b`/`baseline-vite`. P01 không merge mã sản phẩm; lịch sử phát sinh trong `worked.md`.

## PR và bằng chứng CI P01

PR nháp P01: https://github.com/ducmanhletruong/Pharmacy-Study/pull/2, base phase-00 (xếp chồng PR #1). CI công cụ spike trên commit 3c5f761 đã success: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43078944161 . Chỉnh tiếp theo chỉ nới điều kiện ngày về đúng plan; cần lấy kết quả CI của commit mới trước khi báo CI mới đạt.

## Cập nhật cuối theo trả lời hosting

Chủ dự án chọn tiếp tục local, chưa triển khai production; ADR-0011 Accepted và không cấp tài nguyên hosting. P01 vẫn chờ live NotebookLM/ba ngày và quyền OpenAI/model run; không dùng quyết định local để tự tuyên bố production hosting đã chốt.

CI cuối cho code công cụ `2e8a5d6` đã success: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43079292723 . Tổng cộng 6 test (4 NotebookLM + 2 evaluator); RDKit, self-check và template-rejection cũng pass. Những thay đổi sau chỉ là tài liệu quyết định này, không cần chạy lại test/build. PR #2 còn draft; không tự merge.

## Kiểm chứng bổ sung cho kết nối MCP

Bốn test classifier Python đã đạt, gồm auth business error với isError=false, list rỗng hợp lệ, JSON text fallback và loại raw private data khỏi report. Probe Cloud trước đó trả transport_connected=true, notebook_access_verified=false, reason=authentication_required; giữ nguyên bằng chứng này. Kết quả Windows mới không thay đổi report Cloud. Lượt tiếp tục thêm recorder: 5/5 test đạt, lint hai file JS và diff check đạt; capture/batch private được git ignore. Không build/test lại app; CI cho code mới chưa được xác nhận.
