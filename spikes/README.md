# P01 — Các thử nghiệm khả thi

Chỉ mã thử và dữ liệu tổng hợp, không được import vào app sản phẩm. Node 24; dependency RDKit được ghim trong package-lock riêng, không thuộc workspace pnpm của app.

```bash
npm --prefix spikes ci --ignore-scripts --no-audit --no-fund
npm --prefix spikes run chem:render
node --test spikes/notebooklm/validate.test.mjs spikes/llm-eval/evaluate.test.mjs
npm --prefix spikes run llm:eval
node spikes/notebooklm/validate.mjs spikes/notebooklm/capture.template.json
```

Lệnh cuối **dự kiến exit 2**, vì template trống không phải bằng chứng NotebookLM đã hoạt động. Các lệnh còn lại phải exit 0. Trong Cloud, thêm `--cache /workspace/.npm-cache` cho lệnh npm ci nếu home không ghi được.

- RDKit: report.json chứa số đo thật; artifacts SVG được tạo lại, không commit. Chạy lại cập nhật timing/timestamp; so sánh hash phân tử để đánh giá tái lập.
- NotebookLM: runbook ở `docs/spikes/notebooklm-access.md`. Validator chỉ kiểm metadata; cần năm chủ đề thật trên ba ngày liên tiếp và kiểm nguồn thủ công. Không lưu cookie/token hoặc giáo trình vào repo.
- LLM: `docs/spikes/llm-eval.md`, ADR-0010. Có reference self-check, chưa có model/API run. Có thể tạo prompt để chạy ở nơi được phép dùng ChatGPT Pro rồi nhập JSON vào evaluator offline.
- Hosting: ADR-0009 vẫn là hồ sơ đề xuất, chưa cấp tài nguyên hoặc chọn provider thay chủ dự án.

P01 không yêu cầu build lại Next.js. Chi tiết task và cổng còn thiếu ở `docs/status.md`, `docs/blockers.md`.
