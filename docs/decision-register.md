# Sổ quyết định

Ngày dùng múi giờ Asia/Saigon. Không coi ASSUMPTION/PROPOSED là quyết định đã duyệt. Bản plan upload mới nhất được lưu nguyên văn tại `IMPLEMENTATION_PLAN.md`, v0.1 DRAFT; không tự sửa các xác nhận lịch sử của tài liệu.

| ID                 | Trạng thái                          | Nội dung / căn cứ                                                                                                                                                                            | Người quyết                    | Ngày       |
| ------------------ | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ---------- |
| CHAT-01 / ADR-0004 | CONFIRMED / Accepted                | Chuyển starter sang Next.js + TypeScript trong pnpm monorepo; trả lời trực tiếp câu hỏi lựa chọn stack trong chat                                                                            | Chủ dự án                      | 2026-11-12 |
| CHAT-02            | CONFIRMED                           | Repo dự án: https://github.com/ducmanhletruong/Pharmacy-Study; được phép tận dụng tài nguyên và tải repo cần thiết. Việc này không tự chốt ngân sách AI/hosting                              | Chủ dự án                      | 2026-11-12 |
| PLAN-P00           | Theo phạm vi tài liệu               | Mục 18 cho phép bắt đầu P00; các phase sau còn cần duyệt chính thức và thông tin tương ứng. P00 local/CI, chưa deploy production                                                             | Plan v0.1 + ngữ cảnh giao việc | 2026-11-12 |
| C-01…C-08          | CONFIRMED trong plan                | Năm môn và yêu cầu nghiệp vụ như mục 2.1 của bản upload. Chưa triển khai nghiệp vụ trong P00                                                                                                 | Tài liệu đầu vào               | 2026-11-12 |
| C-09               | HISTORICAL / cần phân biệt ngữ cảnh | Bản draft ghi “giai đoạn này chỉ lập kế hoạch”. Ngữ cảnh chat hiện tại giao plan để triển khai và đã chọn stack cho P00; không dùng câu lịch sử này để tự kết luận toàn bộ PRD đã được duyệt | Tài liệu + chat                | 2026-11-12 |

## Quyết định chưa chốt

- ADR-0001, ADR-0002 (D-01), ADR-0003, ADR-0005, ADR-0008: PROPOSED.
- ADR-0006, ADR-0007: OPEN, chờ Q5 và Q6 ở P01.
- Q1: MCP NotebookLM không chính thức và quyền sử dụng nguồn.
- Q2: cấu trúc đề, đề cương, quy tắc làm tròn và danh pháp.
- Q3: phạm vi người dùng.
- Q4: thiết bị chính; dùng A-03 responsive/online cho đến khi có thông tin mới.
- Q5: ngân sách hosting/AI và nhà cung cấp ưu tiên.
- Q6: sinh trước rồi duyệt hay sinh trực tiếp, chính sách nguồn web/hình.
- Q7: ngày thi và hạn MVP, chưa chặn P00.
- A-01…A-09, D-01, X-01…X-05 chưa được tự nâng thành CONFIRMED.
- Ngưỡng coverage ở mục 9.4 còn PROPOSED; P00 mới có smoke test, không báo đạt coverage cho module chưa tồn tại.

## Bổ sung P01 — 2026-11-12

- **CHAT-03 — CONFIRMED:** chủ dự án yêu cầu “thực thi tiếp cho tôi”. Cho phép tiếp tục P01 và chuẩn bị/kiểm chứng phần độc lập; không cần xin lại quyền bắt đầu. Không coi đây là duyệt mọi lựa chọn provider hoặc câu trả lời nghiệp vụ OPEN.
- **CHAT-04 — CONFIRMED:** cho phép MCP bên thứ ba, NotebookLM là tài khoản cá nhân. Người dùng báo đã kết nối Codex với NotebookLM. Kiểm tra trong Cloud: không có tool NotebookLM, plugin search rỗng, CLI MCP list 0 server. Chưa biết tên/version/transport server thực; chưa xác nhận kết nối callable ở Cloud.
- **CHAT-05 — CONFIRMED:** ưu tiên dùng OpenAI/ChatGPT Pro của tài khoản hiện có cho AI. Chưa xác minh entitlement, API credit grant, OAuth plan token, model hoặc hạn mức; câu trả lời này không đưa ra ngân sách hosting.
- **P01-T02 — VERIFIED:** RDKit JS/WASM 2026.09.2, 10/10 SVG giống hash giữa hai tiến trình, invalid SMILES bị từ chối; báo cáo thật trong `spikes/chem-render/report.json`. Đây là kết quả spike, không phải duyệt toàn bộ P08.
- Q1 phần cho phép MCP đã giải quyết. Quyền dùng từng nguồn vẫn theo A-07 và phải kiểm tra khi đưa nguồn thật vào hồ sơ. Không suy ra quyền phân phối nguồn từ tài khoản cá nhân.
- ADR-0009 và ADR-0010 bổ sung hồ sơ hosting/OpenAI; PROPOSED về cách tích hợp, không sửa các ADR gốc hoặc tự gán Accepted. Q5 hosting và đường cấp quyền AI đang chờ quyết định/thiết lập thực tế.
- Không có inference API ở spike; reference self-check 5/5 không phải kết quả mô hình. Không đánh dấu đạt cổng P01 khi thiếu bằng chứng NotebookLM năm chủ đề qua ba ngày.

- **CHAT-06 / ADR-0011 — CONFIRMED / Accepted:** chủ dự án chọn “Tiếp tục local, chưa triển khai hosting production (đề xuất)”. Phần lựa chọn môi trường hiện tại của ADR-0009 được thay bằng ADR-0011; production ADR-0006 và ngân sách production vẫn hoãn, không tự chọn Render/Neon. T03 không còn chờ quyết định cho phạm vi local.

- **CHAT-07 — CONFIRMED:** chủ dự án ưu tiên tìm cách nối MCP với NotebookLM. Được tiếp tục cấu hình/thử nghiệm MCP trong môi trường hiện tại; không thay kết nối đã có trên máy riêng.
- **MCP-TRANSPORT — VERIFIED:** đã cài notebooklm-mcp-cli 0.16.2 ở runtime riêng, đăng ký pharmacy-notebooklm với hai tool đọc, MCP initialize/tools/list thực tế đạt (55 tool). Google account chưa xác thực: notebook_list trả lỗi nghiệp vụ dù isError=false. Profile/browser state ở ngoài repo, không có notebook data được commit.
- **MCP-LOGIN — WAITING USER:** browser auth đã mở được trong Cloud; chưa hoàn tất trước timeout 300 giây. Native chat tool hot-load và dữ liệu ba ngày chưa được xác minh. Không nâng trạng thái P01 thành DONE.
