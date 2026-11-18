# Phục hồi và giới hạn đợt2

## Logout và quota

Logout giữ CSRF của NextAuth. Nếu thu hồi DB/audit thất bại, server trả503 và không gửi response xóa session cookie; UI báo chưa thu hồi và cho retry. Chỉ khi retry thành công mới coi cookie cũ bị vô hiệu. Lỗi identity được log bằng mã/requestID cố định, không đưa exception thô vào URL.

RATE_LIMIT_AUTH mặc định120/phút theo rate-client cookie có HMAC; cookie này không phải danh tính đăng nhập. RATE_LIMIT_AUTH_GLOBAL mặc định1200/phút cho anonymous; signed logout dùng quota riêng theo SID. Không dùng X-Forwarded-For làm trusted identity. Cookie mới có thể tạo budget mới; global cap là backstop, không phải chốngDDoS. Hosting tương lai cần trusted edge limit và kế hoạch retention counter; global cap có thể từ chối anonymous login khi flood nhưng không tiêu quota signed logout. Body có cap hiện có và deadline10s; stream treo trả408.

## Provision local bị gián đoạn

Dùng `pnpm db:provision -- --write-local-env`. `.env.provision.json` là journal private chứa credential dự kiến, ghi trước DDL; `.env.provision.lock` giữ một CLI writer. Không log, commit, gửi journal hoặc đặt chúng vào process web. Pattern .env.* đã bị ignore, gồm temp atomic write.

Nếu lỗi giữa chừng, giữ journal và chạy lại sau khi sửa IO/kết nối. Helper không xoay mật khẩu role existing; credential phải probe đúng. Maintenance env được ghi trước runtime env để giữ đường bootstrap. Nếu CLI crash để lại lock, kiểm chắc không còn provision CLI nào chạy trên workspace rồi mới xóa **directory lock** và retry; không xóa journal để chữa lỗi. Credential existing sai/corrupt journal cần admin kiểm cấu hình riêng, không drop role hoặc reset volume.

Ghi file dùng temp600, sync và rename. Windows cần giữ ACL thư mục private theo tài khoản của bạn; không coi mode Unix là thiết lập ACL Windows hoặc bảo đảm phục hồi mọi sự cố phần cứng.

## Recorder capture

Mỗi capture được khóa từ read tới append/rename. Writer khác chờ tối đa5s rồi báo lock busy/stale; lỗi không ghi đè capture. Normal exit giải phóng lock và temp file. Sau process crash, xác nhận không còn terminal/agent đang record đúng capture trước khi xóa directory `<capture>.lock` rồi chạy lại. Không tự reap lock theomtime, không xóa capture, không cần chạy lại gate P01 đã duyệt. Các test chỉ dùng synthetic captures.

## Audit

Malformed high/critical counts, advisory schema, consistency hoặc exit status lạ đều fail. Patch verifier và ngoại lệ exact advisory cũ vẫn áp dụng; raw high không bị đổi thành0. Registry lỗi phải sửa kết nối/kiểm report, không tắt cổng để vượt CI.
