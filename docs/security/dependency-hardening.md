# Mitigation picomatch trong toolchain P03

Audit registry ghi nhận GHSA-fc5q-39xc-vjpf mức high, picomatch <=4.0.7; thời điểm xử lý chưa có release upstream đã vá. Các đường phụ thuộc hiện tại đều dev (ESLint/Vitest); không dùng lý do đó để bỏ qua high toàn cục.

Hai PNPM patch cho 2.3.2 và 4.0.7 từ chối repeated extglob `+()` và `*()` trước khi dựng regex. Đây là hạn chế tính năng có chủ ý để chặn lớp backtracking được advisory mô tả, không phải tuyên bố upstream đã vá hoặc mọi ReDoS đã được loại bỏ. Glob thông thường, `@()` và negative extglob được giữ; cấu hình lint/test hiện tại không cần hai dạng bị chặn. Nếu công cụ mới cần chúng, phải đánh giá lại, không gỡ guard âm thầm.

`pnpm audit:security` kiểm hash patch, module thực sự được ESLint/Vitest resolve và regression trong process con timeout 2 giây; sau đó chạy audit registry thật. Chỉ đúng advisory/version/range/dev-path đã biết và có mitigation được phân loại handled. High/critical mới, runtime path, version/range lạ, metadata thiếu hoặc registry lỗi đều làm cổng thất bại. Raw audit vẫn báo high 1 và moderate 1 (minimatch); không sửa số liệu hay blanket ignore. `pnpm security:test` kiểm classifier bằng các trường hợp âm.

Manifest `picomatch-mitigation.json` ghi hash và phạm vi. Khi upstream có bản sửa, thay patch bằng nâng dependency tối thiểu, chạy lại regression/audit và bỏ ngoại lệ đúng advisory này sau khi audit sạch. Hoàn tác patch mà không có bản sửa tương đương khiến cổng high thất bại và khôi phục rủi ro; không dùng như cách xử lý lỗi CI.
