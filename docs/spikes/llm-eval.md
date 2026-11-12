# P01-T04 — Đánh giá nhỏ đầu ra LLM

- Trạng thái: **đã kiểm 5 đầu ra do Codex sinh trong chat trên nguồn tổng hợp; API/model version và chất lượng chuyên môn chưa xác minh**.
- Provider theo lựa chọn chủ dự án: OpenAI/ChatGPT Pro; cách cấp quyền đang chờ như ADR-0010.
- Không cần API key để chạy bộ đánh giá offline. Không có network call hoặc adapter thanh toán trong mã spike.

## Chạy

```bash
# Tạo prompt để dùng trong tài khoản ChatGPT/Codex đã được cấp quyền.
node spikes/llm-eval/run.mjs --prompts > /tmp/pharmacy-prompts.json
# Kiểm tra harness bằng bản ghi tham chiếu, không phải kết quả LLM.
node spikes/llm-eval/run.mjs
# Sau khi có output thật: gom thành một JSON array, mỗi fixture đúng một object.
node spikes/llm-eval/run.mjs --input spikes/llm-eval/private/candidates.json
# Kiểm chứng các nhánh từ chối quan trọng.
node --test spikes/llm-eval/evaluate.test.mjs
```

CLI trả exit 0 khi batch mẫu đạt các quy tắc máy kiểm tra, exit 2 nếu không đạt. Cờ `provider_access_verified` luôn false vì evaluator offline không kiểm quyền gọi provider. Không gọi output self-check là model evaluation.

Các khóa output: fixture_id, stem, choices [{key,text}] đủ A/B/C/D, correct_answer, explanation, citations [{source_id,location,quote}]. Sources, task và ID có trong prompt được tạo; expected_answer và distractor tham chiếu ở file fixture dùng cho đánh giá.

## Đọc kết quả đúng cách

Golden fixture chỉ là dữ liệu tổng hợp về nhãn/mẫu/mã, có cảnh báo không dùng học thật. Chúng kiểm grounding cơ học và chất lượng cấu trúc, không chấm kiến thức Dược, độ khó hoặc giải thích toàn diện. Admin cần review riêng độ đúng, câu rõ nghĩa, nhiễu hợp lý, giải thích có căn cứ và quyền nguồn trước khi nhận xét model nào phù hợp.

Sau một batch model thật, ghi đúng model/version, chế độ cấp quyền (API credits/plan usage/ChatGPT có người thao tác), thời điểm, usage/cost nếu provider trả được và điểm review. Không điền model hoặc giá ước đoán như số thực đo. Output thật chứa nguồn riêng để trong `private/` bị Git ignore; chỉ đưa báo cáo tổng hợp đã ẩn thông tin lên repo.

## Lượt thăm dò bằng phiên Codex hiện tại — 2026-11-12

Đã xuất prompt bằng `--prompts`, sinh năm MCQ trong phiên Codex hiện tại rồi nhập chúng vào evaluator. Đây là output do agent sinh, không dùng bộ tạo đáp án reference-self-check. Các nguồn và câu trả lời đều tổng hợp, không chứa nội dung NotebookLM.

```bash
node spikes/llm-eval/run.mjs --input spikes/llm-eval/codex-session-candidates.json
```

Kết quả thật: **5/5 đạt** kiểm tra A/B/C/D, đáp án theo fixture, quote và vị trí nguồn. Lưu output trong `codex-session-candidates.json`, kết quả và hash prompt/output trong `codex-session-report.json`. Chỉ các output tổng hợp này được commit; output lấy từ nguồn riêng vẫn phải để trong private.

Đây là đánh giá thăm dò không mù: cùng phiên agent đã đọc evaluator trước khi sinh câu. Các nhiễu là mã fixture giả định, chưa chứng minh chất lượng câu thi. Không có đánh giá chuyên môn độc lập, không có knowledge query thật, không đo độ khó hoặc độ chính xác Dược. Không dùng tỷ lệ 5/5 này để chọn model production hay suy ra mục tiêu 98%.

Model/version chính xác, usage và cost không được phiên cung cấp để xác minh nên ghi null, không đoán. Không gọi API bên ngoài, không chứng minh entitlement Pro hoặc luồng OAuth/API của website. P01-T04 vẫn cần chốt cách cấp quyền và đánh giá model định danh trên nguồn được phép dùng trước khi kết luận tích hợp khả thi.
