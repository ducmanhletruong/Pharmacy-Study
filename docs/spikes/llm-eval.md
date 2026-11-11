# P01-T04 — Đánh giá nhỏ đầu ra LLM

- Trạng thái: harness đã chuẩn bị và kiểm tra; **chưa đánh giá model thật**.
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
