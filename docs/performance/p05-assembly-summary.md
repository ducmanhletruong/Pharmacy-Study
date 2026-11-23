# Đo thời gian tạo đề

Hai phép đo dùng ngân hàng 20.000 câu tổng hợp. Trong phép đo trực tiếp API handler lắp đề **10 câu**, p95 giảm từ 1.126,79 ms xuống 174,46 ms. Với HTTP local qua Next.js và đề **120 câu**, p95 giảm từ 742,75 ms xuống 283,78 ms.

Hai cặp số đo có phạm vi khác nhau. Kết quả dùng để so sánh trước và sau trong từng kịch bản. Mốc đại diện vận hành thực tế cần đo với tải và cấu hình của môi trường phát hành.
