# Nhật ký phần việc ngoài plan

Ghi nối tiếp theo từng tác vụ. Phân biệt việc đã thực hiện, đề xuất chưa làm và kết quả kiểm tra thực tế. Không ghi dữ liệu bí mật.

## 2026-11-12 — Tạo quy định và tài liệu bàn giao

### Plan ban đầu

Tạo `AGENTS.md` để agent nhận quy định; tạo `handoff.md` bàn giao trạng thái; tạo `worked.md` báo cáo đầy đủ việc ngoài plan. Ưu tiên sửa tối thiểu, không tự refactor và tiết kiệm usage/credits.

### Kết quả trong plan

- Đã tạo đúng ba file tài liệu tại `/workspace/web-starter`.
- Quy định rõ điều kiện build, trường hợp không test, giới hạn refactor/dependency và phạm vi kiểm tra tối thiểu.
- Đã ghi trạng thái dự án và cách tiếp tục vào `handoff.md`.
- Dùng tên chuẩn `AGENTS.md` như đã nêu trước khi thực hiện.

### Phần ngoài plan

Không có. Không sửa code ứng dụng, cài dependency, refactor, khởi động server hoặc chạy build/test trong tác vụ này.

### Kiểm tra và giới hạn

Đọc lại ba file và kiểm tra sự tồn tại. Không chạy `npm run check`, test hoặc build vì thay đổi chỉ ở Markdown. Nhật ký này bắt đầu từ tác vụ hiện tại; không có đủ plan gốc để phân loại hồi tố toàn bộ bước setup trước đó là trong/ngoài plan.

---

## Mẫu cho tác vụ tiếp theo

Khi có tác vụ mới, thêm mục với các thông tin sau; không ghi đè mục cũ:

- **Ngày và tác vụ:**
- **Plan ban đầu:** mục tiêu, phạm vi, kiểm tra dự kiến.
- **Kết quả trong plan:** phần đã hoàn thành.
- **Phần ngoài plan:** ghi từng phần; nếu không có, ghi “Không có”.
- **Lý do phát sinh và căn cứ thực hiện:** yêu cầu người dùng hoặc sự cần thiết với mục tiêu; dẫn chỉ dẫn liên quan nếu có.
- **Tác động thực tế:** file thay đổi, lệnh đáng kể đã chạy, dependency/cấu hình/dữ liệu bị tác động.
- **Kết quả:** hoàn thành, thất bại, còn dở hoặc đề xuất chưa thực hiện.
- **Kiểm tra:** lệnh/kết quả thực tế; phần không chạy và lý do.
- **Rủi ro và hoàn tác:** cách quay lại nếu có; không ghi đè thay đổi của người dùng.
- **Việc còn lại:** bước tiếp theo hoặc blocker cụ thể.

## 2026-11-12 — P00: khung dự án theo implementation plan

### Plan ban đầu

Đọc bản `IMPLEMENTATION_PLAN.md` upload mới nhất; thực hiện duy nhất P00-T01…T07: pnpm workspace, TypeScript strict, công cụ lint/format/test, PostgreSQL local, tài liệu quyết định và trạng thái, CI, app Next.js tối thiểu và health endpoint. Chạy đúng kiểm chứng P00; không triển khai nghiệp vụ hoặc phase kế tiếp.

### Căn cứ từ chủ dự án

- Cho phép tận dụng tài nguyên cần thiết, tải repo GitHub nếu thiếu.
- Trả lời trực tiếp: chuyển sang Next.js + pnpm theo plan.
- Cung cấp repo `ducmanhletruong/Pharmacy-Study`; cho phép nối remote và kiểm tra CI trong ngữ cảnh câu hỏi đã trả lời.

### Kết quả trong plan

Đang triển khai P00; kết quả kiểm chứng cuối cùng sẽ được bổ sung vào mục này và `docs/status.md`. Dùng package chính thức qua registry thay vì tải repo không cần thiết; không gọi AI, truy cập NotebookLM hoặc tạo tài nguyên hosting trả phí.

### Phát sinh 1 — Starter hiện có, chưa phải repo Git rỗng

- Lý do: môi trường đã có starter Vite do lần setup trước, trong khi P00 giả định repo rỗng.
- Căn cứ: lựa chọn chuyển framework của chủ dự án; bảo toàn thay đổi trước khi thay cấu trúc.
- Đã làm: `git init -b phase-00`, commit baseline `39ffc0b`, tạo nhánh local `baseline-vite`. Chỉ stage file nguồn/cấu hình/tài liệu; không stage `.env.local`, dependency hoặc output build.
- Tác động: thêm lịch sử Git local; thay scaffold Vite bằng Next.js ở `apps/web`, gỡ entry/config/lockfile npm cũ khi chuyển sang pnpm. Không phải refactor tính năng sản phẩm vì starter chưa có nghiệp vụ.
- Kết quả: bản cũ có thể tham chiếu qua commit/nhánh baseline.
- Rủi ro/hoàn tác: dùng worktree riêng tại commit baseline để xem lại; không reset đè dữ liệu hiện tại.

### Phát sinh 2 — Repo GitHub đã có commit README

- Lý do: repo không hoàn toàn rỗng như tiên quyết P00. `origin/main` có duy nhất README và commit `ada6490`.
- Đã làm: kiểm tra repo bằng GitHub connector và Git; thêm remote, fetch, merge hai lịch sử mà không force-push. Xung đột add/add chỉ ở README đã được giải quyết bằng giữ hướng dẫn starter và tên repo trước khi viết README P00. Commit nối lịch sử: `c830ffe`.
- Tác động: lịch sử remote được giữ nguyên; thay đổi P00 nằm trên nhánh `phase-00`.
- Kiểm chứng: `git ls-tree` xác nhận remote chỉ có README, không có code khác bị ghi đè.
- Rủi ro/hoàn tác: PR vào main để chủ dự án xem trước; không tự merge.

### Phát sinh 3 — Quyền ghi và cấu hình pnpm 11

- Lý do: lượt `pnpm install` đầu tiên thất bại vì muốn tạo store trong `/home/agent/.local/share/pnpm`, thư mục không ghi được trong sandbox. pnpm 11 không đọc cấu hình công cụ thông thường từ `.npmrc` như phiên bản trước.
- Đã làm: chuyển cấu hình store/cache sang `pnpm-workspace.yaml`, dùng `.pnpm-store/` trong checkout và bỏ qua bằng Git. Chỉ sửa cấu hình dự án, không sửa HOME, proxy, CA hoặc cấu hình toàn hệ thống.
- Lượt cài tiếp theo có cảnh báo `stateDir` không được đặt ở project và `packageManagerStrict` không được nhận diện; sẽ loại bỏ hai khóa không dùng sau khi lượt cài đang chạy kết thúc.
- Kết quả/kiểm chứng: chờ lượt frozen install cuối cùng; không coi lượt thất bại là đã đạt.
- Rủi ro/hoàn tác: store/cache là dữ liệu cài đặt có thể tái tạo; không commit store.

### Phát sinh 4 — Thay server phát triển cũ

- Lý do: server Vite của lần setup trước vẫn chạy ở cổng 5173 sau khi chuyển framework.
- Đã làm: xác minh đúng tiến trình Node của Vite trong checkout và gửi TERM cho PID 1093. Server Next.js sẽ dùng cổng 3000 sau kiểm chứng.
- Tác động: cổng preview thay từ 5173 sang 3000; đã ghi README. Không dừng tiến trình dịch vụ khác.
- Hoàn tác: nếu quay về baseline trong checkout riêng, dùng lệnh Vite của baseline.

### Công cụ bên ngoài và kiểm chứng bắt buộc

- Docker daemon sẵn có, chỉ tạo PostgreSQL local với named volume mới; cổng DB chỉ bind loopback.
- Tải gitleaks 8.30.1 từ release GitHub chính thức vào `/tmp/pharmacy-tools`, xác minh SHA-256 theo checksum release trước khi dùng. Công cụ này phục vụ kiểm chứng P00 được plan yêu cầu; không thêm dependency runtime.
- Kiểm tra tag GitHub Actions chính thức và ghim SHA, không dùng action có quyền ghi không cần thiết.
- Chưa có chi phí token AI/NotebookLM/hosting bên ngoài được kích hoạt; GitHub Actions là kiểm chứng CI bắt buộc của P00. Không ước lượng credits đã tiết kiệm.

### Kiểm chứng cuối cùng và phần còn lại

Đang chờ dependency install, PostgreSQL healthcheck và các kiểm chứng P00. Kết quả thực tế được bổ sung sau, không dùng kết quả starter Vite để báo đạt.

### Phát sinh 5 — Tương thích dependency khi chuyển sang Next.js

- Lý do: `pnpm peers check` cho thấy `eslint-plugin-import@2.32.0`, `eslint-plugin-jsx-a11y@6.10.2` và `eslint-plugin-react@7.37.5` trong cấu hình Next.js chưa khai báo hỗ trợ ESLint 10 của starter cũ.
- Đã làm: ghim ESLint 9.39.5 để thỏa peer của bộ Next.js chính thức, bỏ dependency trực tiếp `@eslint/js` không còn dùng. Giữ TypeScript 6.0.3 phù hợp peer của typescript-eslint. Không dùng force/legacy-peer-deps để bỏ qua xung đột.
- Lượt cài offline để tận dụng cache thất bại do thiếu metadata đầy đủ cho kiểm tra supply-chain của pnpm; chuyển lại install online với proxy/CA mặc định, không tắt kiểm tra supply-chain hoặc TLS.
- pnpm tự thêm ngoại lệ tuổi phát hành cho đúng phiên bản Prettier 3.10.0 đã ghim; nội dung được giữ rõ trong workspace config, không nới kiểm tra cho các package khác.
- PostgreSQL đã healthy và báo phiên bản 17.11; ghim `17.11-alpine` cùng digest đã pull trong cả Compose và CI để tránh image local/CI lệch nhau.
- Kết quả cuối: xem phần kiểm chứng bổ sung sau. Không tự coi dependency được cập nhật là đã kiểm tra.

### Điều chỉnh ranh giới task — smoke test có ý nghĩa

- Handler `/api/v1/health` của T07 được commit sớm cùng T03 để smoke test kiểm tra hợp đồng thật (HTTP status, JSON content type và body) thay vì phép kiểm tra luôn đúng. Không thêm endpoint hoặc tính năng ngoài P00.
- Local đã đạt `pnpm lint`, `pnpm typecheck`, `pnpm test` (1 test) và `NEXT_TELEMETRY_DISABLED=1 pnpm build`. Compose ghim image đã healthy. Các cổng clean clone/CI/HTTP còn chờ; chưa báo phase DONE.
