# ADR-0009 — Hồ sơ khả thi hosting và PostgreSQL

- Trạng thái: **PROPOSED; chờ ngân sách hosting và lựa chọn của chủ dự án**.
- Ngày: 2026-11-12 (Asia/Saigon).
- Bổ sung bằng chứng cho ADR-0006. Không supersede quyết định Accepted nào; ADR-0006 vẫn OPEN cho đến khi chọn phương án. Giữ nguyên file ADR trước đó theo quy tắc lịch sử mục 15 của plan.
- Phạm vi: P01-T03, không tạo tài nguyên hoặc deploy.

## Bối cảnh

App là Next.js Node + PostgreSQL, cần pg_trgm/citext. Ngân sách hosting chưa được trả lời: câu trả lời Q5 mới chốt mong muốn tận dụng ChatGPT Pro cho AI, không xác định tiền hosting. Cloud dev hiện có không được coi là hosting production hoặc cam kết uptime.

## Phương án có thể duyệt

| Phương án                                  | Phù hợp                                      | Hạn chế / chi phí cần chốt                                                                                           |
| ------------------------------------------ | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Tiếp tục local/dev với Compose             | Làm P02 và phát triển trước khi chọn hosting | Không cung cấp production; cần máy/môi trường đang chạy                                                              |
| Next.js Node trên Render + Neon PostgreSQL | Preview chi phí thấp, DB có đường nâng cấp   | Free web ngủ sau 15 phút nhàn rỗi; Neon Free có scale-to-zero và quota; chưa chứng minh NFR tải 3 giây/uptime/backup |
| Node host và PostgreSQL managed trả phí    | Mùa thi cần availability tốt hơn             | Chủ dự án phải chốt trần chi phí app, DB, asset, backup và bandwidth trước khi chọn tier/region                      |

Nguồn chính thức kiểm tra 2026-11-12: [Render Free](https://render.com/docs/free), [Render pricing](https://render.com/pricing), [Neon plans](https://neon.com/docs/introduction/plans), [Neon pg_trgm](https://neon.com/docs/extensions/pg_trgm), [Neon citext](https://neon.com/docs/extensions/citext). Tài liệu Neon liệt kê Free $0/tháng và hai extension cần dùng; quota/giá có thể đổi. Render khuyến cáo free instance cho thử nghiệm thay vì production. Không coi free tier là bằng chứng đạt mục tiêu 99% trong mùa thi.

## Đề xuất để review

Ưu tiên hoàn thiện local trước; nếu chủ dự án chọn ngân sách bằng 0 cho preview thì đánh giá Render Free + Neon Free bằng project thử sau khi được chọn. Nếu yêu cầu uptime mùa thi giữ nguyên, chọn tier luôn hoạt động và kế hoạch backup phù hợp thay vì cố giữ free bằng traffic giả. Đây là đề xuất, chưa phải quyết định hosting.

Chi phí cần duyệt = compute web + PostgreSQL + asset/bandwidth + backup; chi phí AI tách riêng. Chưa có trần nên không tự chọn số tiền, vùng triển khai hoặc cấu hình trả phí.

## Kiểm chứng còn thiếu và phương án thất bại

Sau khi chọn provider: kiểm extension bằng kết nối thực, quyền DB, pooled/direct connection, export/restore và đo cold start/tải trang trên điều kiện mục tiêu. Backup RPO 24h/RTO 4h còn là giả định chưa được chứng minh. Nếu free tier không đáp ứng, quay về local để tiếp tục phát triển hoặc trình phương án paid trước khi cấp tài nguyên.

Cổng P01-T03 chưa đạt: cần chủ dự án chọn phương án/budget. Không tạo secret, tài khoản hoặc hóa đơn trong spike này.
