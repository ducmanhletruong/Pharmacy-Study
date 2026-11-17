# P01-T02 — Khả thi RDKit JS/WASM

- Trạng thái: **DONE cho spike Node/WASM**, chưa tích hợp sản phẩm.
- Ngày: 2026-11-12 (Asia/Saigon).
- Package chính thức: `@rdkit/rdkit@2026.9.2`, binary báo `2026.09.2`, giấy phép BSD-3-Clause. Phiên bản và integrity nằm trong `spikes/package-lock.json`.
- Nguồn: [RDKit chính thức](https://github.com/rdkit/rdkit), README và type declarations trong package đã cài. Không build lại RDKit từ repo vì binary WASM chính thức đã đáp ứng spike.

## Cách chạy

```bash
npm --prefix spikes ci --ignore-scripts --no-audit --no-fund
npm --prefix spikes run chem:render
```

Trong Cloud giới hạn ghi home, thêm `--cache /workspace/.npm-cache` cho lệnh npm ci. Spike dùng npm lockfile riêng, nằm ngoài workspace apps/packages và không thay pnpm lockfile hay dependency của ứng dụng.

## Phương pháp và kết quả thực đo

10 SMILES tự tạo trong `spikes/chem-render/molecules.json`, gồm mạch thẳng, carbonyl, vòng thơm, vòng no, ion và stereochemistry. Hai tiến trình Node độc lập khởi tạo WASM riêng, dựng SVG 360×240, so SHA-256 và canonical SMILES. Đầu vào SMILES không hợp lệ phải bị từ chối; handle WASM được delete sau mỗi phân tử.

| Chỉ số                          | Kết quả                  |
| ------------------------------- | ------------------------ |
| Thời điểm đo UTC                | 2026-11-11T18:21:58.016Z |
| Node / nền tảng                 | v24.22.1 / linux x64     |
| SVG tái lập giữa hai tiến trình | 10/10 giống hash         |
| Khởi tạo WASM                   | 490.124 và 479.344 ms    |
| Render một phân tử, lượt đầu    | 1.014–126.060 ms         |
| Kích thước SVG                  | 1493–10604 bytes         |
| SMILES lỗi                      | Bị từ chối               |

Chi tiết hash/timing: `spikes/chem-render/report.json`. SVG tái tạo ở `spikes/chem-render/artifacts/` và bị Git bỏ qua. Chạy lại sẽ cập nhật timestamp/timing của report; các con số chỉ mô tả executor đã đo, không phải SLA hoặc p95.

## Đề xuất và giới hạn

Đề xuất dùng RDKit JS cho bước render offline của P08; chưa chọn phương án chạy trong browser, chưa thêm WASM vào bundle Next.js. Không kết luận tên IUPAC hoặc nội dung Dược đã được kiểm chứng chỉ vì render thành công. Các assertion SVG ở spike chỉ kiểm tra mẫu được sinh; không phải sanitizer cho nội dung tải lên.

P08 cần thử thêm cấu trúc theo đề cương, giấy phép và cơ chế sanitize trước khi phục vụ người học. Nếu JS/WASM không đáp ứng môi trường đích, phương án dự phòng là RDKit Python offline xuất SVG cùng bundle. Không triển khai phương án dự phòng khi JS spike đang đạt.
