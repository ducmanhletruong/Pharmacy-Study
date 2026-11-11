# Quy định làm việc cho agent

Áp dụng cho toàn bộ dự án `web-starter`. Đọc file này trước khi sửa code; đọc thêm `handoff.md` và các mục gần nhất trong `worked.md` để tiếp tục công việc. Chỉ dẫn trực tiếp của người dùng được ưu tiên trong phạm vi không trái chỉ dẫn cấp cao hơn.

## 1. Phạm vi và plan

- Xác định yêu cầu, tiêu chí hoàn thành và phạm vi file cần sửa trước khi thao tác.
- Với việc nhỏ, nêu plan ngắn trong chat; không tạo thêm file plan. Với việc nhiều bước, nêu rõ các bước và phần kiểm tra dự kiến.
- Tự hoàn thành các bước đã được yêu cầu hoặc cần thiết để hoàn thành yêu cầu; không hỏi lại các quyết định nhỏ, có thể đảo ngược.
- Nếu xuất hiện yêu cầu mở rộng không cần thiết cho mục tiêu, ghi nhận đề xuất và chờ người dùng yêu cầu; không tự triển khai.

## 2. Cách sửa code

- Đọc phần code liên quan trước khi sửa. Tìm có mục tiêu bằng `rg`; không đọc hoặc quét toàn repo nếu không cần.
- Chỉ thay đổi tối thiểu để đáp ứng yêu cầu. Giữ nguyên style, cấu trúc, tên và hành vi ngoài phạm vi.
- Không tự ý refactor, đổi tên, di chuyển file, dọn code, đổi kiến trúc hoặc tạo abstraction để phục vụ giả định tương lai.
- Chỉ refactor khi người dùng yêu cầu hoặc bắt buộc để sửa đúng vấn đề. Nếu bắt buộc, giới hạn ở phần liên quan và ghi lý do vào `worked.md`.
- Không tự thêm/nâng cấp dependency, sửa lockfile hoặc đổi cấu hình công cụ trừ khi cần cho yêu cầu. Khi cần, chọn thay đổi nhỏ nhất và ghi rõ lý do.
- Không ghi đè hoặc hoàn tác thay đổi của người dùng. Không sửa file sinh tự động như `dist/` hoặc nội dung `node_modules/` bằng tay.
- Không format toàn repo cho một thay đổi nhỏ. Chỉ format file đã sửa khi cần.

## 3. Khi nào được build

Chỉ build khi có ít nhất một lý do sau:

- Người dùng yêu cầu build, bản production hoặc triển khai.
- Thay đổi liên quan bundler, dependency, cấu hình build, entry point hoặc tài nguyên mà kiểm tra nhẹ hơn không đủ xác minh.
- Cần tái hiện/sửa lỗi chỉ xuất hiện khi build.
- Tiêu chí hoàn thành hoặc quy định bắt buộc yêu cầu build.

Trước khi build, nêu ngắn lý do. Mỗi trạng thái code chỉ build một lần; chỉ chạy lại khi có thay đổi ảnh hưởng build hoặc có lỗi cần xác minh sau khi sửa. Không build sau mỗi lần chỉnh file.

## 4. Khi nào không được test

- Không viết hoặc chạy test cho thay đổi chỉ ở tài liệu, comment, nội dung chữ, định dạng hoặc CSS đơn giản, có thể đảo ngược và không đổi logic. Kiểm tra trực tiếp phần thay đổi là đủ.
- Không thêm test chỉ để lặp lại implementation hoặc kiểm tra chi tiết nội bộ không có giá trị bảo vệ hành vi.
- Không chạy toàn bộ test suite, browser test, chụp ảnh hay quay video như bước mặc định.
- Không chạy lại kiểm tra đã đạt nếu không có thay đổi mới liên quan hoặc nghi vấn chưa giải quyết.
- Nếu người dùng yêu cầu không test cho tác vụ cụ thể, không chạy test trừ khi chỉ dẫn cấp cao hơn bắt buộc; báo rõ phần chưa được xác minh.

Với logic, xử lý dữ liệu hoặc lỗi có nguy cơ tái phát, chọn kiểm tra nhỏ nhất đủ chứng minh hành vi. Ưu tiên test có sẵn, có mục tiêu. Chỉ thêm test khi nó bảo vệ một hành vi có ý nghĩa. Chỉ mở rộng kiểm tra khi phát hiện lỗi hoặc có phụ thuộc liên quan. Yêu cầu test rõ ràng từ người dùng hoặc kiểm tra bắt buộc được ưu tiên hơn mặc định tiết kiệm ở trên.

## 5. Tiết kiệm usage/credits

- Dùng lượng đọc, sửa và kiểm tra nhỏ nhất đủ hoàn thành đúng yêu cầu. Không cắt bớt phần việc đã được yêu cầu để tiết kiệm.
- Gộp các lượt đọc/tìm độc lập; giới hạn output; tránh đọc lại nội dung đã biết.
- Không dùng sub-agent, dịch vụ trả phí, sinh ảnh, trình duyệt hoặc công cụ nặng nếu tác vụ không cần. Chỉ dùng sub-agent khi người dùng hoặc chỉ dẫn áp dụng yêu cầu.
- Không cài công cụ hay khởi động server nếu công cụ/server hiện có đủ dùng. Kiểm tra server đang chạy trước khi mở thêm.
- Không chạy `npm run check` mặc định: lệnh này gộp typecheck, lint, format và build. Chọn riêng lệnh cần thiết, giới hạn vào file liên quan nếu công cụ hỗ trợ.
- Không chạy kiểm tra trùng lặp: `npm run build` đã chạy TypeScript, không chạy thêm typecheck cho cùng trạng thái code nếu không có lý do riêng.
- Không polling liên tục. Với tiến trình lâu, chờ có giới hạn và chỉ kiểm tra lại khi cần.
- Báo cáo ngắn: đã sửa gì, đã kiểm tra gì, giới hạn còn lại. Không khẳng định đã test/build nếu chưa chạy; không ước lượng credits đã tiết kiệm khi không có số liệu.

## 6. Bàn giao và ghi việc ngoài plan

- Khi kết thúc tác vụ có sửa file hoặc có phát sinh, cập nhật `handoff.md`: yêu cầu, kết quả, file thay đổi, kiểm tra thực tế, việc còn lại và cách tiếp tục.
- `handoff.md` mô tả trạng thái mới nhất, không sao chép toàn bộ lịch sử chat.
- `worked.md` là nhật ký nối tiếp. Không xóa hoặc viết lại lịch sử để che phần phát sinh; bổ sung đính chính nếu cần.
- Ghi đầy đủ mọi việc đã làm ngoài plan ban đầu, kể cả việc nhỏ: phát sinh gì, vì sao, căn cứ thực hiện, file/lệnh đã tác động, kết quả, kiểm tra, rủi ro và cách hoàn tác nếu có.
- Nếu phát sinh chưa được làm, ghi rõ là đề xuất/chưa thực hiện; không mô tả như đã hoàn thành.
- Nếu không có phát sinh, ghi một dòng xác nhận trong mục tác vụ. Không tạo việc ngoài plan chỉ để điền báo cáo.
- Không ghi secret, token, mật khẩu hoặc nội dung `.env` thật vào hai file báo cáo.

## 7. Thực hiện IMPLEMENTATION_PLAN.md theo phase

- Mỗi lần giao việc chỉ thực hiện một phase. Đọc `IMPLEMENTATION_PLAN.md`, `AGENTS.md`, `docs/decision-register.md` và `docs/status.md` trước khi bắt đầu.
- Kiểm tra tiên quyết. Nếu thiếu, ghi chính xác task/phase bị chặn trong `docs/blockers.md`; tiếp tục phần độc lập đã được cho phép. Không vượt qua cổng bằng giả định.
- Làm task theo phụ thuộc; chạy kiểm chứng bắt buộc của phase. Các kiểm chứng đó là ngoại lệ có căn cứ cho mặc định tiết kiệm build/test ở trên. Không thêm lượt chạy ngoài nhu cầu xác minh.
- Cập nhật `docs/status.md` trong cùng commit với thay đổi task; phản ánh bảng phase ở mục 16 của plan, không báo DONE khi cổng chưa đạt. Bản upload v0.1 được giữ nguyên làm nguồn tham chiếu; trạng thái thực thi mới nhất ở `docs/status.md`.
- Dừng ở cổng phase; không tự bắt đầu phase kế tiếp. Không tự bịa cấu trúc đề, quy tắc nghiệp vụ, tên nhà cung cấp hoặc câu trả lời OPEN.
- ADR PROPOSED/OPEN chưa được coi là Accepted. Chỉ ghi Accepted khi có quyết định thực tế của chủ dự án.
- Không commit tài liệu có bản quyền, tài khoản, phiên đăng nhập hoặc secret thật. Dữ liệu mẫu phải là tổng hợp và ghi nhãn.
- Các lệnh chưa được thiết lập phải ghi “to be established”; không chạy rồi coi như đã pass. Chỉ thêm test mới và cổng CI theo phase hiện hành.
