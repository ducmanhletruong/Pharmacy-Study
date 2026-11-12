# ADR-0010 — OpenAI với quyền lợi ChatGPT Pro

- Trạng thái: **PROPOSED cho cách tích hợp; nhà cung cấp OpenAI là lựa chọn đã xác nhận của chủ dự án**.
- Ngày: 2026-11-12 (Asia/Saigon).
- Bổ sung ADR-0007, không chỉnh/xóa lịch sử ADR gốc. Chưa supersede bằng một quyết định kỹ thuật Accepted.
- Phạm vi: P01-T04; không gọi API hoặc khởi tạo billing.

## Yêu cầu đã xác nhận

Chủ dự án yêu cầu “Sử dụng API AI của Chatgpt Pro tài khoản này”. Ghi nhận ưu tiên dùng OpenAI và quyền lợi tài khoản hiện có; không suy ra model, số dư API, ngân sách số tiền hoặc token đã được cấp cho Cloud.

## Ba đường sử dụng cần phân biệt

1. **Codex/ChatGPT hiện có, có người thao tác:** chuẩn bị prompt tổng hợp, chủ dự án chạy trong nơi đã đăng nhập, xuất JSON để evaluator/import offline kiểm tra. Tận dụng phiên đang dùng nhưng chưa phải một API adapter tự động.
2. **Sign in with ChatGPT / plan usage:** tài liệu hiện hành hỗ trợ dùng gói ở app/tool tham gia và được người dùng cấp quyền. Cần luồng đăng ký ứng dụng, OAuth và consent riêng; app-server chỉ dùng token được cấp cho ứng dụng đó. Chưa có quyền này trong Cloud hiện tại.
3. **OpenAI API với API credits từ Pro nếu đủ điều kiện:** cần claim/link đúng API organization và key/project credential riêng. Có thuê bao không đồng nghĩa grant đã được kích hoạt. API billing và giới hạn vẫn quản lý riêng.

Nguồn chính thức kiểm tra ngày 2026-11-12: [dùng gói ChatGPT trong app khác](https://help.openai.com/en/articles/20001542-using-your-chatgpt-plan-in-other-apps-and-sites), [Codex app-server với token plan](https://developers.openai.com/siwc/token-sharing-open-source/codex-app-server), [API credits cho thuê bao đủ điều kiện](https://help.openai.com/en/articles/20001626-api-credits-benefit-for-eligible-chatgpt-subscriptions), [billing ChatGPT/API](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform).

Nếu chọn API credits: trong Settings → Billing của ChatGPT, kiểm tra quyền lợi API credits và liên kết organization phù hợp; xác nhận số dư ở API Platform trước khi gọi. Không tự claim, thay billing, mở auto-recharge hoặc lấy token phiên ứng dụng. Nếu dùng OAuth, dùng flow cấp quyền chính thức của ứng dụng; không copy token của Codex Desktop sang server.

## Đề xuất cụ thể

Hiện tại dùng bộ prompt/evaluator offline ở `spikes/llm-eval` để chuẩn bị đánh giá; không phát sinh lời gọi API. Sau khi chủ dự án chọn đường cấp quyền thực tế và thiết lập credential qua settings, kiểm thử một batch nhỏ trên nguồn được phép dùng, ghi provider/model/version, thời điểm, usage/cost có số liệu và hạn mức trước khi làm P06.

Chưa chọn model hoặc cam kết giá khi chưa biết entitlement/rate limit của tài khoản. Không viết API adapter giả rồi báo đã kết nối Pro. Với cách người dùng chạy prompt trong Codex, lượng sử dụng vẫn tính theo gói và hạn mức của tài khoản; không coi là không tốn usage.

## Bộ đánh giá nhỏ

Năm nguồn tổng hợp tự viết có nhãn năm môn; chỉ kiểm extraction, A/B/C/D, một đáp án đúng và citation từ văn bản mẫu. Có kiểm tra đáp án theo golden fact, trùng lựa chọn, citation giả và bản ghi trùng/thiếu. Reference self-check đạt 5/5 không phải kết quả của model thật và không chứng minh độ chính xác kiến thức Dược 98%.

Lượt bổ sung ngày 2026-11-12: năm output sinh bằng phiên Codex hiện tại đạt evaluator 5/5, lưu trong `spikes/llm-eval/codex-session-report.json`. Đánh giá không mù, chỉ trên nhãn tổng hợp; không phải reference-self-check nhưng cũng chưa chứng minh chất lượng chuyên môn hoặc API. Không biết model/version chính xác, token/cost, quyền API hoặc OAuth app; các giá trị chưa đo để null. Chưa đủ bằng chứng để chuyển quyết định tích hợp thành Accepted.

Khi API/plan không dùng được hoặc chạm hạn mức, dừng batch, giữ ngân hàng đã duyệt và chuyển phương thức được chủ dự án chọn; không âm thầm dùng provider khác hoặc nguồn web khác.
