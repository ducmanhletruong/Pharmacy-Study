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

### Bổ sung kiểm chứng local

- `pnpm install` online cuối đã thành công, không còn cảnh báo peer ở kết quả install sau khi ghim ESLint tương thích.
- Đã loại bỏ hai khóa workspace không được pnpm 11 nhận diện/cho phép (`stateDir`, `packageManagerStrict`); store/cache vẫn nằm trong checkout.
- `pnpm lint`, `pnpm typecheck`, `pnpm test` (1/1), `NEXT_TELEMETRY_DISABLED=1 pnpm build` đạt. Next.js build đủ route `/` và `/api/v1/health`.
- `docker compose ... up -d --wait` đạt sau khi ghim image/digest, PostgreSQL báo 17.11.
- Đã chạy production server tạm thời, kiểm tra HTTP status/body health và HTML trang chủ bằng curl, rồi dừng bằng Ctrl+C.
- Tạo clone local độc lập ở `/tmp/pharmacy-study-p00-clean`, không mang theo node_modules hoặc .next. Chia sẻ duy nhất pnpm package cache bằng symlink `.pnpm-store` để tiết kiệm tải mạng; dependency links và output build được tạo mới trong clone. Đây là kiểm chứng clean clone bắt buộc của P00, không phải build lặp không có mục đích.
- Các kiểm chứng clean clone/CI còn đang chờ tại thời điểm mục bổ sung này; sẽ ghi kết quả thực tế sau.

### Bổ sung kiểm tra định dạng và secret

- `pnpm format:check` phát hiện một lỗi định dạng trong `infra/docker-compose.yml` (chuỗi image/digest dài). Đã format đúng file này; không đổi cấu hình Compose về mặt ngữ nghĩa và không build lại vì sửa Markdown/YAML format. Chờ lần format check xác nhận cuối.
- Gitleaks 8.30.1 đã quét 10 commit hiện tại, không phát hiện secret. File plan gốc được kiểm bằng `cmp`, trùng byte với bản upload mới nhất.

### Phát sinh 6 — Next.js tự tạo hướng dẫn cho agent

- Lý do: khi `pnpm dev` chạy trong môi trường agent, Next.js 16.4.6 tự sinh `apps/web/AGENTS.md` qua tính năng agentRules. File ban đầu xuất hiện là untracked sau các commit nguồn.
- Đã làm: đọc tài liệu agentRules và route handlers đi kèm package Next.js đúng phiên bản; giữ nguyên block do framework quản lý, thêm đoạn đầu xác nhận quy định root AGENTS vẫn áp dụng và commit file. Không tắt hoặc đổi config runtime để che file phát sinh.
- Tác động: chỉ tài liệu hướng dẫn; không thay đổi app, dependency hoặc build config. Prettier check cho file đã đạt trước khi thêm đoạn dẫn; format lại đúng file trước khi commit.
- Hoàn tác: không xóa block bằng tay vì next dev sẽ tạo lại. Nếu sau này muốn tắt, cần quyết định thay agentRules theo tài liệu Next.js; chưa thực hiện thay đổi đó.

### Đính chính ghi nhận định dạng

Mục trước ghi lỗi format Compose do chuỗi image/digest dài; diff thực tế cho thấy Prettier chỉ xuống dòng mảng `healthcheck.test`. Không có thay đổi giá trị image, healthcheck hoặc hành vi DB trong commit format `50403d8`.

### Kết quả cuối của P00

- Hoàn thành P00-T01…T07; mỗi task có commit riêng, bổ sung các commit baseline/nối lịch sử/bằng chứng/format cần thiết đã nêu.
- Local đạt lint, typecheck, Vitest 1/1, build và HTTP production health/homepage. PostgreSQL 17.11 local healthy.
- Clone sạch `/tmp/pharmacy-study-p00-clean` đạt `pnpm install --frozen-lockfile`, lint, typecheck, test, build và format:check. Không tái sử dụng node_modules/.next; chỉ chia sẻ cache lúc cài, sau đó bỏ symlink cache tạm; git status của clone sạch.
- GitHub Actions run **43074691952** trên code commit **50403d8f7898a8de48c827f3521f172077584cb3** hoàn tất **success**. Frozen install, lint, format, typecheck, test, build, HTTP health và gitleaks đều thành công; Postgres service healthy.
- PR nháp: https://github.com/ducmanhletruong/Pharmacy-Study/pull/1. Đã attach PR vào chat; không merge, không deploy production.
- Gitleaks local quét lịch sử 10 commit không phát hiện secret; CI quét toàn bộ lịch sử PR cũng đạt. Plan gốc trùng byte với upload mới nhất.
- Dev server Next.js chạy ở cổng 3000 và health endpoint đã phản hồi đúng. Server production thử nghiệm còn tiến trình con sau Ctrl+C ở pnpm; đã xác định đúng next-server PID 4636 và gửi TERM, rồi mới mở dev server, không chạy hai server trên cùng cổng.
- Bổ sung sau code commit chỉ là tài liệu và file agent do framework sinh, không cần build/test code lại theo AGENTS. Workflow GitHub có thể tự kiểm chứng commit tài liệu cuối khi push; không dùng kết quả chưa chạy để khẳng định CI của SHA mới.
- Không thực hiện phase khác, không thêm nội dung môn học, schema/migration, auth, AI/NotebookLM hoặc tài nguyên hosting trả phí. Chưa có nội dung để chứng minh AC-1…AC-8 của toàn MVP.
- Dừng ở cổng P00 theo mục 10.1 của plan. P01 còn chờ chủ dự án duyệt tài liệu và trả lời Q1/Q5; không tự quyết các OPEN hoặc giả định bản quyền.

## 2026-11-12 — P01: khảo sát khả thi sau lệnh tiếp tục

### Plan ban đầu

Thực hiện duy nhất P01-T01…T04: bộ kiểm tra NotebookLM, spike RDKit, hồ sơ hosting và hồ sơ/eval LLM. Theo AGENTS, làm phần độc lập khi còn thiếu thông tin; không tự vượt qua cổng bằng giả định.

### Căn cứ và kết quả

Chủ dự án cho thực thi tiếp, xác nhận MCP bên thứ ba/tài khoản cá nhân và chọn OpenAI/ChatGPT Pro. Đã ghi quyết định và giới hạn trong decision register. P00 cuối đã CI success trên `44848b1`; PR #1 chưa merge.

- T01: chuẩn bị runbook/template/validator; 3 test đạt và template trống bị từ chối. Cloud không có NotebookLM tools/MCP server; chưa gọi notebook thật, chưa có observation ba ngày. Không giả lập cổng live.
- T02: package chính thức RDKit 2026.9.2, BSD-3-Clause; 10/10 SVG tái lập qua hai process, invalid SMILES bị từ chối; report có số đo thật. Không clone/build toàn RDKit khi binary chính thức đủ dùng.
- T03: hồ sơ đề xuất ADR-0009 có phương án, nguồn, chi phí cần chốt, rủi ro cold start và phương án khi thất bại; chưa chọn hosting thay chủ dự án.
- T04: ADR-0010 ghi lựa chọn OpenAI và phân biệt quyền lợi Pro/API; tạo prompt/evaluator 5 fixture tổng hợp, reference 5/5, 2 test đạt. Sau khi bổ sung kiểm tra citation giả ở danh sách, chạy lại đúng evaluator liên quan và đạt. Không gọi API hoặc mô hình ngoài chat, không đếm reference self-check thành model run.
- Lint chỉ trên spikes đã pass; format chỉ file mới/thay đổi. Không test/build lại Next.js vì app, root lockfile và config runtime không đổi.

### Phát sinh 1 — Kết nối người dùng chưa callable trong Cloud

- Người dùng báo đã nối NotebookLM với Codex, nhưng tool inventory hiện tại không có NotebookLM, Plugin Management tìm NotebookLM trả danh sách rỗng, CLI MCP list trong executor có 0 server. Không in raw config, env hoặc credential.
- Dùng skill plugin-management để kiểm tra trước khi đề xuất cách thao tác thủ công; không tìm thấy plugin để sử dụng trong chat này. Không cài MCP bên thứ ba mới hoặc yêu cầu Google login khi đã có kết nối riêng của người dùng.
- Kết quả: chỉ chốt khả năng quan sát của Cloud; không kết luận kết nối trên máy người dùng bị lỗi. Chuẩn bị bộ kiểm tra tại nơi có kết nối và ghi blocker thật.
- Không có thay đổi cần hoàn tác đối với account/MCP của chủ dự án.

### Phát sinh 2 — ChatGPT Pro và quyền API hiện hành

- Tra tài liệu OpenAI chính thức thay vì dựa vào giả định cũ rằng thuê bao luôn không có quyền lợi API. Tài liệu hiện có SIWC/plan usage cho tích hợp hỗ trợ và API credits với Pro đủ điều kiện, vẫn có cơ chế cấp quyền và account/billing riêng.
- Chưa kiểm được entitlement/grant/số dư cụ thể của tài khoản này trong Cloud, nên chỉ chuẩn bị hồ sơ/evaluator offline. Không lấy token Codex Desktop, không tự activate billing hoặc chạy thêm agent/LLM để tạo kết quả giả.
- Lời chọn Pro cho AI không được suy rộng thành ngân sách hosting.

### Phát sinh 3 — Cô lập mã thử và lưu lịch sử ADR

- Dùng `spikes/package.json`/npm lockfile riêng với duy nhất dependency RDKit, chạy Node ESM trực tiếp để không kéo WASM hoặc toolchain vào app/pnpm workspace. Script .mjs là mã thử/công cụ, chưa phải module TypeScript sản phẩm. Không thêm compile step cho spike.
- Theo quy tắc ADR không sửa lịch sử, viết ADR-0009/0010 bổ sung hồ sơ cho các placeholder 0006/0007 thay vì sửa tại chỗ. Chưa đánh dấu phương án triển khai là Accepted.
- Tác động chỉ spikes và docs; loại bỏ spikes khỏi sản phẩm không cần DB rollback, có thể revert commit của phase sau khi kiểm tra thay đổi người dùng.

### Phát sinh 4 — CI riêng cho công cụ spike và PR xếp chồng

- P00 PR còn draft; làm trên nhánh phase-01 dựa phase-00 để không merge thay người dùng và giữ diff P01 riêng.
- Bổ sung workflow phase-01 cho PR vào main/phase-00, chỉ khi spikes/workflow thay đổi. Native tests, npm ci ghim và WASM sample; không rebuild app hoặc gọi NotebookLM/LLM trong CI. Đây là bổ sung kiểm chứng mã spike, không tính là phase sản phẩm mới.
- Snapshot CI tự kiểm template trống bị từ chối để tránh báo false-positive kết nối. CI pass chỉ nói công cụ hoạt động, không gỡ blocker live ba ngày.
- Kết quả CI thực tế và URL PR sẽ được ghi sau khi push; không báo đạt trước khi chạy.

### Giới hạn và bàn giao

P01 chưa DONE: thiếu live MCP/ba ngày, quyết định hosting và quyền OpenAI/model run thật. Ghi cụ thể trong blockers và handoff; không tự chuyển P02, không tạo hosting hoặc thêm câu hỏi thật. Không có tài liệu có bản quyền/secret được đưa vào repo.

### Bổ sung kết quả và đính chính P01

- PR nháp https://github.com/ducmanhletruong/Pharmacy-Study/pull/2 được tạo và attach vào chat, base phase-00; không merge PR nào.
- CI spike commit 3c5f761 success, run https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43078944161 . CI này không gọi NotebookLM hoặc model, không chứng minh cổng live.
- Gitleaks quét 17 commit, không phát hiện secret; Prettier cho toàn bộ file P01 đã đạt.
- Rà plan phát hiện validator/runbook đã thêm điều kiện “ba ngày liên tiếp” quá chặt so với “ổn định qua 3 ngày” của P01-T01. Đã sửa về ít nhất ba ngày lịch khác nhau, giữ yêu cầu năm chủ đề đủ mỗi ngày và không chấp nhận lặp một ngày/future timestamp; bổ sung ca test ngày có khoảng trống. Bốn test NotebookLM hiện tại thay cho ba test ban đầu. Đây là sửa sai lệch do triển khai, không phải thay đổi yêu cầu của chủ dự án.
- Chỉ chạy lại lint và test của validator bị sửa, không chạy lại RDKit hoặc app local đã đạt; CI sẽ tự kiểm công cụ trên commit mới. Không báo CI của SHA mới pass khi chưa có kết quả.

### Quyết định hosting và CI cuối P01

- Chủ dự án trả lời chọn tiếp tục local, chưa triển khai hosting production. Đã ghi ADR-0011 Accepted, supersedes phần môi trường hiện tại của đề xuất ADR-0009; ADR-0006 production vẫn OPEN. Không đổi runtime hoặc cấp tài nguyên.
- Gỡ blocker lựa chọn hosting cho giai đoạn hiện tại; không tự đặt ngân sách production hoặc coi các mục tiêu uptime/backup đã đạt.
- CI công cụ commit 2e8a5d6 đã success: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/43079292723 . Sáu test, RDKit hai process, reference self-check và từ chối template live trống đều đạt.
- Cập nhật sau kết quả CI chỉ là Markdown về quyết định và bàn giao; chỉ format/đọc phần thay đổi, không lặp test/build. Workflow spike có paths filter nên không chạy lại công cụ cho commit chỉ tài liệu.
- P01 chưa DONE: còn kết nối callable, năm chủ đề trên ba ngày và quyền OpenAI/model run thật. Những phần này không được bịa để vượt cổng.

## 2026-11-12 — Ưu tiên nối MCP NotebookLM

### Plan và căn cứ

Chủ dự án yêu cầu ưu tiên tìm cách nối MCP. Tiếp tục P01-T01: khảo sát server được duy trì, cài cô lập, kiểm MCP handshake và read-only notebook_list, đăng ký Codex, thực hiện bước login khả dụng. Không chuyển phase hoặc refactor app.

### Thực hiện và kết quả thật

- Xác minh PyPI/package repo notebooklm-mcp-cli 0.16.2, Python >=3.11; đọc README/authentication/remote deployment. Cài bằng uv trong /workspace/.pharmacy-notebooklm/venv, không đưa 82 dependency Python vào app. MCP SDK 2.3.0, FastMCP 4.1.8. Runtime state mode 0700 ở ngoài checkout.
- MCP stdio đã initialize với protocol 2025-11-25 và list 55 tool thành công. ServerInfo.version 4.1.8 là giá trị framework; ghi riêng version CLI để không nhầm.
- Lần probe đầu dùng kiểu timeout timedelta và field protocolVersion trực tiếp theo SDK cũ, bị lỗi client do SDK 2 đã đổi API. Đã đối chiếu signature và sửa sang float timeout/model_dump(by_alias=True); không coi lỗi client này là Google auth thất bại.
- Đã gọi notebook_list(max_results=1) thật. MCP isError=false nhưng payload status=error do không có auth; thêm classifier và 4 regression test để không báo false-positive. Chỉ xuất metadata/count, không xuất raw notebook/title/ID/token.
- Đã dùng codex mcp add với cấu hình có một server pharmacy-notebooklm, rồi giới hạn enabled_tools vào notebook_list/notebook_get. Giữ nguyên các phần config khác; không thay trust/approval policy. Lưu global config của executor ngoài sandbox bằng escalation được auto-review chấp thuận; không thay file trên máy riêng của người dùng.
- `codex mcp list` xác nhận server enabled, transport stdio. auth_status=unsupported là OAuth MCP không áp dụng, không phải bằng chứng Google login. Native tool inventory của chat chưa hot-load, đã ghi rõ trong report.

### Phát sinh Desktop và đăng nhập

- Dùng cloud-desktop skill để mở và quan sát Desktop. Browser tab API báo “Browser Use could not read requirements”; dùng Sky screenshot/native window observation để kiểm tra. Một thao tác input native gặp AT-SPI unavailable; không dùng Playwright/CDP tự viết để thao tác UI thay CUA.
- Login CLI lúc đầu không mở được Chromium trong sandbox, ngoài sandbox vẫn thiếu Xauthority. Đã xác định DISPLAY và đường dẫn Xauthority của Xorg đang chạy bằng metadata process, không in nội dung authority/cookie. Với cấu hình X11 đúng, thư viện mở được browser/profile riêng và trang NotebookLM yêu cầu Sign in. Không tắt sandbox browser hoặc mở HTTP MCP ra Internet.
- Đã handoff cho chủ dự án qua Desktop/Take over để đăng nhập Google; CLI chờ 300 giây nhưng không có xác thực hoàn tất, timeout rồi đóng auth browser. Không coi trang HTTP 200, NID cookie hoặc chỉ mở landing page là đăng nhập thành công. Kết thúc CUA bằng summary sau khi quan sát cửa sổ auth đã đóng.
- Phần còn thiếu: chủ dự án đăng nhập trực tiếp khi sẵn sàng. Không lấy cookie của máy riêng, không thu mật khẩu/token qua chat, không tạo tài khoản Google mới.

### Ngoài plan / file và phạm vi tác động

- Thêm probe_mcp.py và test stdlib vì server Python đã có SDK, tránh cài thêm JS SDK/transitive dependency vào app. Cấu hình mẫu Codex và requirements riêng phục vụ tái tạo setup, không có credential. Thêm ignore **pycache** và bước unit test Python trong CI spike.
- Thêm connection-report.json đã lọc dữ liệu để bàn giao transport/account tách biệt. Report live ban đầu không có notebook content; folder state, auth và venv luôn ở ngoài repo.
- Thay đổi global Codex config và cài runtime là mở rộng so với spike chỉ tài liệu ban đầu, được yêu cầu ưu tiên kết nối hiện tại và quyền dùng MCP bên thứ ba của chủ dự án cho phép. Không tự cho phép tool write/delete hoặc tạo public endpoint.
- Đã đọc tài liệu OpenAI về project/global MCP và Secure MCP Tunnel. Tunnel là phương án có thêm quyền/key cho server trên máy riêng, chưa tạo hoặc đề nghị expose server không xác thực.

### Kiểm chứng và hoàn tác

Bốn unit test parser đạt; live MCP handshake/catalog và auth-required outcome đã kiểm chứng. Không rebuild/test app hoặc lặp RDKit. Để hoàn tác cấu hình môi trường, chỉ xóa server pharmacy-notebooklm bằng codex mcp remove sau khi kiểm tra nó còn là server của tác vụ này; không xóa cấu hình khác. Không xóa state/profile có tài khoản thật nếu chưa được yêu cầu. Thay đổi repo có thể revert riêng commit kết nối, không cần migration/DB rollback. CI và PR được cập nhật sau commit; chỉ ghi pass khi có kết quả.

## 2026-11-12 — Ghi nhận MCP Windows đọc được 47 notebook

- Căn cứ: chủ dự án cung cấp kết quả notebook_list thành công, 47 notebook, chỉ đọc. Ghi đúng nguồn bằng chứng là báo cáo từ Windows; không tuyên bố agent Cloud tự gọi thành công.
- Cập nhật docs/spikes/notebooklm-access.md, docs/blockers.md, docs/status.md, docs/decision-register.md và handoff.md: tiếp tục kiểm chứng P01-T01 bằng tay tại Windows; không yêu cầu đăng nhập Cloud lặp lại. Giữ nguyên report probe Cloud chưa xác thực và lịch sử kiểm tra.
- Còn thiếu truy vấn kiến thức/citation, quyền dùng từng nguồn, cùng năm chủ đề trên ba ngày và model run thật. Không đánh dấu P01 DONE hoặc bắt đầu phase sau.
- Kiểm tra: đọc diff và git diff --check cho thay đổi Markdown; không chạy test/build vì không đổi logic theo AGENTS.md.
- Ngoài plan: không có thay đổi code, dependency, cấu hình MCP hoặc credential; chỉ điều chỉnh hồ sơ bàn giao sau kết quả kết nối. Không lấy dữ liệu notebook hoặc phiên Google. Có thể hoàn tác riêng diff tài liệu, không tác động tài khoản/runtime.

## 2026-11-12 — P01-T01: chuẩn bị lượt kiến thức thật tại Windows

- Chủ dự án yêu cầu tiếp tục; đã xác nhận quyền dùng tài liệu năm notebook cho học tập cá nhân, không công khai giáo trình. Ghi CHAT-08, không hỏi lại quyền nguồn cho cùng phạm vi.
- Đọc turn gần nhất của đúng chat local “Kết nối Codex với NotebookLM”: có notebook_list trên gemini-notebook-mcp hoàn thành và kết luận 47 notebook. Không gửi tin nhắn hoặc kích hoạt agent local; chat Cloud vẫn không có tool NotebookLM callable.
- Thêm spikes/notebooklm/record.mjs để nhập batch đã đối chiếu, tính SHA-256 UTF-8/số Unicode code point, nối capture và giữ lịch sử. Từ chối dữ liệu chưa grounded, thiếu nguồn/vị trí, thời gian tương lai, topic/day trùng theo giờ Việt Nam; chỉ đọc/ghi file nằm trong private bị Git ignore, lỗi JSON không in snippet riêng tư. Không gọi MCP hoặc tự nhận định tính đúng của nguồn.
- Thêm record.test.mjs kiểm các rủi ro trên, cập nhật workflow P01 để chạy test mới. Thêm docs/spikes/notebooklm-windows-handoff.md với một đoạn giao việc cho chủ dự án gửi sang nơi có MCP; có thể dùng bản clone branch phase-01, không ghi đè checkout có thay đổi. Không dựng thêm tunnel/login/browser hoặc dependency.
- Cập nhật runbook, status, blockers, decision-register và handoff. Chưa có observation kiến thức/citation, chưa đủ ba ngày; không mở phase sau.
- Ngoài plan: helper ghi metadata là phần bổ sung cần thiết cho bộ kiểm chứng P01-T01 nhằm tránh tính hash hoặc sửa lịch sử bằng tay; không đổi mã sản phẩm, DB, runtime, billing hoặc credential. Hoàn tác bằng revert riêng commit, giữ nguyên hồ sơ private thật.
- Kiểm chứng: 5/5 test recorder đạt, gồm CLI lưu ngày chưa đủ cổng và bảo toàn file khi từ chối; ESLint hai file JS exit 0; Prettier chỉ file thay đổi và git diff --check đạt. git check-ignore xác nhận capture/batch private bị bỏ qua. Không build/test lại app, RDKit hoặc Python parser vì không có thay đổi liên quan.

## 2026-11-12 — P01-T04: năm đầu ra thăm dò bằng Codex hiện tại

- Căn cứ: chủ dự án yêu cầu tiếp tục, ưu tiên OpenAI/Pro và tiết kiệm usage. Xuất năm prompt tổng hợp bằng run.mjs --prompts, agent sinh năm MCQ trong chính phiên chat này, lưu codex-session-candidates.json. Không lấy đáp án bằng generator reference-self-check, không dùng tài liệu NotebookLM hoặc nguồn ngoài.
- Nhập output bằng run.mjs --input: 5/5 đạt quy tắc cấu trúc, đáp án fixture và exact quote/source locator. Lưu codex-session-report.json với timestamp thật, hash prompt/output, nguồn tổng hợp, external_api_calls=0 và provider_access_verified=false. Việc gọi lại evaluator để lưu report là xuất bằng chứng, không phải lượt sinh model thứ hai.
- Đánh giá không mù vì phiên đã đọc evaluator; các câu chỉ là bài đọc mã/nhãn tổng hợp và có nhiễu giả định. Không coi là benchmark chất lượng đề Dược. Model/version, usage/cost không có số xác minh nên ghi null; không giả số model hoặc giá, không claim entitlement hoặc API adapter của app.
- Cập nhật docs/spikes/llm-eval.md, ADR-0010, status/blockers/decision-register và handoff. ADR tích hợp vẫn PROPOSED/OPEN. Không mở P02/P06 hoặc yêu cầu API key trong chat.
- Ngoài plan: dùng output của phiên Codex hiện tại thay cho chờ API credential để có một lượt thăm dò cơ học ngay; không thay thế bài kiểm định model/API còn thiếu. Chỉ lưu dữ liệu tổng hợp được phép commit, không thêm dependency hoặc gọi API trả phí. Hoàn tác bằng revert commit báo cáo riêng.
- Kiểm chứng: evaluator exit 0 với 5/5 mẫu; chỉ format/đọc diff và kiểm hash báo cáo sau format. Không chạy lại suite/test/build đã đạt vì không sửa logic evaluator.

### CI và bàn giao lượt tiếp tục P01

- Đã commit riêng P01-T01 `a1e7cf4`, P01-T04 `0dc5d96` rồi push một lần vào phase-01, giữ PR #2 draft và base phase-00. Cập nhật mô tả PR theo trạng thái cuối, không merge/deploy hoặc gửi bình luận cho người khác.
- GitHub Actions run 43157607324 trên `0dc5d96fbf774c764abd0b0063503b5dcd796f42` SUCCESS. Job feasibility-tools và các bước 11 test Node, 4 test Python, RDKit hai process, reference self-check và từ chối template trống đều success. CI không truy cập NotebookLM hoặc gọi AI; không suy ra live gate từ kết quả này.
- Đã yêu cầu mở file handoff Windows trong panel phải của chat hiện tại; app trả queued, chưa xác nhận người dùng đã thấy file. Không điều khiển Windows hoặc chuyển credential, không kích hoạt agent khác.
- Bổ sung CI vào status/handoff và ghi rõ recorder chỉ cần Node24, không cần cài lại server hoặc dependency app. Đây là cập nhật tài liệu sau kiểm chứng; không lặp test/build. Bước còn lại phải chạy nơi có MCP Windows và thu đủ ba ngày thật.

## 2026-11-12 — P01-T01: ghi nhận lượt kiến thức đầu tiên ở Windows

- Căn cứ: chủ dự án báo đã clone riêng phase-01 tại c50fda9 vào work/Pharmacy-Study, chạy 5/5 query thành công. Recorder lưu 3 observation (Hóa hữu cơ 2, KTCT, Vi sinh); Hóa phân tích và Giải phẫu sinh lý pending citation metadata. Validator exit 2, 0/3 ngày đủ năm chủ đề. Đối chiếu và đọc điều khoản do agent thực hiện, admin chưa review.
- Chỉ đọc turn mới nhất của đúng chat local, lọc và đối chiếu tên/status tool cùng final: năm notebook_query và năm source_get_content hoàn thành, báo cáo khớp thông tin chủ dự án. Không đọc hoặc sao chép raw capture/nguồn, không gọi MCP từ Cloud hoặc kích hoạt agent local.
- Đọc có mục tiêu source của package CLI 0.16.2 đã cài trong Cloud: dịch vụ query có thể trả success với citations rỗng/references rỗng; parser có thể bỏ citation khi cấu trúc passage không phù hợp. Đây là hành vi mã hiện tại, chưa chứng minh nguyên nhân của hai phản hồi Windows, không suy ra version Windows từ Cloud. Không sửa package, cấu hình hoặc credential.
- Cập nhật status/blockers/decision-register, runbook và handoff: ghi đúng 5 query/3 observation/2 pending/0 ngày hoàn tất, giữ admin review pending. Bổ sung hướng kiểm hai phản hồi đã lưu trước khi query lại, phân biệt citation metadata với đối chiếu nguyên văn nguồn, không giả ngày/nguồn hoặc lặp ba observation đã lưu.
- Windows đang có thay đổi public chưa commit/push và dữ liệu private bị ignore. Cloud chỉ cập nhật tóm tắt, chưa merge các thay đổi local đó; không thao tác working tree Windows hoặc yêu cầu upload raw nguồn. Hướng đọc remote dùng fetch/git show nếu cần, không pull/reset ghi đè local.
- Ngoài plan: không có thay đổi mã hoặc chức năng; làm rõ phương pháp chẩn đoán metadata và ranh giới agent/admin để không báo cổng đạt sai. Hoàn tác riêng commit tài liệu, không ảnh hưởng capture private hoặc các chỉnh sửa chưa commit trên Windows.
- Kiểm chứng: chỉ format file Markdown đã sửa, đọc diff và git diff --check; không chạy test/build hoặc lặp CI spike vì không đổi logic/dependency/workflow. Kết quả live dựa trên báo cáo và lịch sử call local, không phải Cloud tự chạy lại validator.

## 2026-11-17 — hoàn tất cổng P01 theo bằng chứng Windows

Đối chiếu ba turn cuối chat local: ngày 17/11 đủ 15 observation/ba ngày và exit 0. Ngày 13/11 từng lỗi auth, refresh_auth khôi phục và 5 query đạt; không xác nhận phiên vô thời hạn. Chủ dự án trực tiếp xác nhận đã duyệt grounding và điều khoản. Ghi kết quả tổng hợp, không lấy nguồn/credential/private capture.

Chuẩn bị ADR-0006/0007 theo đúng quyết định local/OpenAI đã có, giữ production/API integration chưa xác minh. Đính chính việc tự thêm điều kiện API hoạt động vào cổng P01; plan chỉ yêu cầu hồ sơ quyết định/spike, adapter ở P06. Không thay plan gốc, không tạo billing. Chủ dự án yêu cầu bước kế tiếp nên chuyển P02; không tự merge PR.

Môi trường Cloud được khôi phục với /workspace không có repo cũ. Đã clone branch phase-01 từ remote, giữ nguyên Windows có dữ liệu private/chỉnh sửa riêng. Đây là phát sinh môi trường, không phục hồi phiên Google hoặc package MCP cũ. Chỉ kiểm diff cho tài liệu, không test/build P01 lại.

## 2026-11-17 — P02: luồng luyện MCQ tổng hợp

### Phạm vi và thực hiện

Theo lệnh tiếp tục bước sau và sau khi owner duyệt cổng P01, tạo branch phase-02 trên phase-01. P01 docs commit 240a4ee đã push; không merge PR #1/#2. Chỉ triển khai P02, không tự bắt đầu P03.

- T01/T02: SQL migration 0001, 9 bảng và indexes/constraints trong plan; forward-only, khóa và checksum chống đổi migration cũ. Seed tự viết một môn, một cây topic, 10 MCQ (có công thức), hash/revision cố định; không overwrite revision hoặc truncate attempts khi seed lại. Drizzle và pg là dependency cần cho DB theo hướng đề xuất trong plan.
- T03: grade theo label bất kể thứ tự, kiểm A/B/C/D, lựa chọn không trống/trùng và đúng một đáp án. Unit 2 ca bảo vệ các lỗi dữ liệu; health smoke giữ nguyên.
- T04: contract Zod và API-01..06; practice-only, filter topic gồm descendant, count thiếu trả 422. Idempotency theo user/key và payload hash, Origin, dữ liệu lỗi an toàn, ownership, pin revision, khóa đồng thời answer/submit, submit lặp cùng kết quả và freeze bài đã nộp. Đề GET/create không lộ đáp án/nguồn/giải thích. Integration/contract 7 ca với Postgres thật, dọn riêng attempt của test và restore revision bị thay để kiểm snapshot.
- T05/T06: UI tiếng Việt, bộ câu mẫu có nhãn tổng hợp, chọn topic/count, trả lời, feedback/nguồn, lưu/resume bằng URL, điểm và thống kê topic. KaTeX trust=false cho công thức. Hai E2E Chromium: đủ 10 câu/reload/kết quả và mobile390px; đã xem screenshot thật, không tràn ngang. Không tự nhận đây là kiến thức Dược hoặc dữ liệu NotebookLM.
- Package cần thiết ghim: drizzle-orm0.45.4, pg8.23.1, zod4.6.7, katex0.19.1, tsx4.23.15, Playwright1.65.1 và types tương ứng. Không nâng nền Node/pnpm/Next/React/TS, không cài framework/ảnh/tài nguyên ngoài nhu cầu. Install xác minh supply-chain policy.

### Phát sinh và sửa lỗi trong lúc kiểm chứng

- Cloud không còn repo/runtime cũ sau resume, clone branch đúng và tạo DB Compose mới theo image17.11 ghim digest. Không sửa Windows/copy cookie; không xóa volume có dữ liệu người dùng. .env mới chỉ chứa giá trị local-dev-only từ example và bị ignore.
- Lint đầu báo link nội bộ dùng a: đổi thành Next Link và reset state khi về trang chủ. pg cảnh báo Promise.all trên một connection: chuyển đọc choices trong transaction sang tuần tự, integration kiểm lại đạt.
- Launcher Node với env-file flag không tương thích cách runtime truyền NODE_OPTIONS: thay bằng launcher dev.mjs dùng process.loadEnvFile, không sửa/unset NODE_OPTIONS. Tách loader .env CLI khỏi module DB dùng trong Next để không đưa đường dẫn .env vào bundler.
- E2E phát hiện Next16 chặn HMR khi hostname127.0.0.1 khác bind host; thêm đúng hai allowedDevOrigins loopback, không wildcard. E2E tiếp theo phát hiện Origin so với request.url đã bị Next normalize thành0.0.0.0: dùng Host thực với whitelist loopback mặc định, hoặc APP_ORIGIN rõ ràng cho proxy. Thêm regression cho normalized Host và domain không tin cậy; không tắt CSRF/Origin. E2E cuối 2/2 đạt.
- Production build đạt nhưng test guard đầu timeout: instrumentation đã báo lỗi dev-mode song Next giữ handle sống. Thêm start.mjs kiểm config trước khi Next mở cổng; check-production-guard đạt exit0 ngay, instrumentation vẫn là lớp kiểm độc lập. Không rebuild sau thay đổi launcher JS vì bundle app đã build không đổi.
- Audit: 0 high/critical, 1 moderate minimatch (toolchain). Không tự nâng dependency nền ngoài phạm vi để sửa advisory không chặn cổng hiện tại. CI vẫn chạy audit mức high.

### Kiểm chứng và giới hạn

DB migrate/seed rỗng rồi lặp đạt; unit3/3, integration/contract7/7, E2E2/2, production build và guard đạt. Typecheck đã đạt trước build, có kiểm riêng CLI DB/contract không nằm trong bundle; không lặp typecheck sau build. Lint lỗi link đã sửa và file liên quan đã kiểm; format/lint toàn diff và CI được ghi khi hoàn tất. Mọi lượt chạy lại đều vì thay đổi/lỗi cụ thể ở trên, không lặp spike P01. Không gọi API AI, tạo billing hoặc triển khai production.

Ngoài plan: launcher dev/start và regression Host/Origin là phần cần thiết để P02 chạy đúng và giữ chốt production; không refactor app nền không liên quan. Report/handoff được cập nhật để bỏ trạng thái pending cũ đã được owner giải quyết. Hoàn tác code bằng revert commit P02; không xóa private Windows hoặc DB volume. Migration đã áp dụng không sửa/xóa khỏi DB có dữ liệu; dùng forward migration nếu cần đổi schema.

### Kết quả cuối P02 và bàn giao

- Review cuối phát hiện idempotency hash phụ thuộc thứ tự key khi topic_ids bị bỏ trống so với []; chuẩn hóa object cố định và thêm assertion cùng nghĩa phải replay. Integration7/7 đạt sau sửa. Không rerun E2E local đã đạt vì thay đổi nằm ở chuẩn hóa đầu vào và đã có regression mục tiêu; CI sau đó chạy toàn bộ code cuối.
- Lint toàn repo, format:check và git diff --check đạt. CLI migrate/seed sau khi tách loader cũng đạt; .env/test-results bị ignore. Tải gitleaks8.30.1 vào /workspace/.pharmacy-tools ngoài Git, kiểm checksum chính thức đã dùng ở P00; scan29 commit không có secret. Không dùng công cụ giả lập để claim pass.
- Commit theo task: f85e9c2 T03, f56241f T01/T02 cùng dependency/launcher setup cần thiết, bf86d90 T04, f771a7b T05/T06 và báo cáo. Push phase-02 một lần, tạo PR nháp #3 base phase-01 và attach vào tác vụ. PR #2 được cập nhật theo P01 owner review, không đóng/merge.
- CI f771a7bc11b8e52753fa068cad2bb8ad2e5ba115 run44133096057 SUCCESS. Tất cả bước frozen install/lint/format/typecheck/migrate-empty/seed-rerun/unit3/integration7/E2E2/build/production-guard/audit-high/gitleaks đều success. Đây là build/code cuối, bao gồm sửa idempotency; không suy ra từ build local trước sửa đó.
- P02 DONE, không có deployment hay P03. Thêm hướng dẫn local-practice cho Windows/Linux, giữ nguyên clone Windows có private capture/chỉnh sửa riêng. Ghi trạng thái mới nhất vào handoff/status/blockers/register; thay các dòng pending cũ, không xóa lịch sử worked.md.
- Commit sau kiểm chứng này chỉ chứa Markdown về CI và bàn giao, kiểm diff trực tiếp, không chạy lại local test/build. Workflow GitHub có thể tự chạy theo sự kiện synchronize; không nới cổng hoặc sửa trust/approval để né kiểm tra.

## 2026-11-18 — P03 danh tính, phân quyền, audit

### Phạm vi

User yêu cầu nêu bước kế tiếp và thực hiện; chốt Q3 lớp được mời/Google. Triển khai T01–T06: auth/session/allowlist, authorize default deny, owner guards, audit và DB roles, Origin/CSP/limit, kiểm auth. Không P04, UI quản lý user, public signup, AI hoặc deploy. ADR-0008 cập nhật theo quyết định thật.

### Thực hiện và kiểm chứng

NextAuth4.24.15 stable được kiểm compatibility Next16/React19 và handler await headers/cookies; không patch thư viện auth. Identity không tự liên kết chéo provider/email, Google email verified; session8h có revoke DB, whitelist và role được kiểm lại. Không ghi access/refresh token. Ma trận96 ô quyền + default deny, unit tổng104, integration14 với PG thật, E2E8 Chromium testprovider đã đạt; P02 10câu/mobile vẫn đạt. Admin không mặc nhiên đọc attempt người khác. App role bị từ chối UPDATE/DELETE/TRUNCATE audit và DDL. Bodystream cap, requestID, no-store, Origin/Host và nonce CSP được kiểm; inline style cần KaTeX. Production build đạt, startup guard dev/test đạt. Không claim đăng nhập Google thật: thiếu OAuth client và email cấu hình private, runbook đã chuẩn bị.

### Phát sinh ngoài plan và sửa lỗi

- Tạo worktree phase-03 và DB pharmacy_study_p03 riêng để bảo toàn checkout/server3000/DB P02; không copy auth Windows. Role login nằm mức cluster nhưng grant/ownership chỉ DB P03. Helper provision localhost là công cụ cần thiết cho app/migrator tách biệt, không xoay credential role có sẵn; giữ các dòng env không liên quan, file private600. CLI maintenance đọc .env.db, launcher lọc credential đặc quyền khỏi child. Runtime probe kiểm session_user thật, không chỉ current_role. Runbook hướng dẫn khôi phục ADMIN_EMAILS và cấu hình private.
- Thêm dependency cần auth (next-auth, zod/web, core workspace) và exports DB, sửa launcher đọc env + PORT/preflight; không nâng framework nền. Type lỗi UUID inference được sửa bằng string explicit; lint location.assign trong login được đổi router replace/refresh. Launcher gặp TDZ runtimeEnv, đã sửa trước chạy guard đạt.
- Integration cleanup ban đầu dùng app_rw DELETE nên bị từ chối đúng thiết kế; chuyển cleanup/fixture snapshot sang maintenance pool, không tăng quyền web. E2E dùng tài khoản .invalid và secret synthetic riêng, không Google/cookie thật. CI cần bootstrap migration trước tạo login; phase-02 main job được thay bằng phase-03 superset để tránh chạy đường bootstrap cũ trên role mới.
- Audit phát sinh GHSA-fc5q-39xc-vjpf high picomatch<=4.0.7, chưa có upstream patched release. Kiểm advisory/PR liên quan và không áp dụng PR không liên quan. Thêm PNPM patches cho2.3.2/4.0.7 chặn +()/*() extglob; manifest hash, verifier resolve module thật, child timeout2s, classifier fail closed exactID/version/devpath. Raw audit vẫn high1/moderate1, không ignore chung. Bốn classifier tests và verifier hai bản đạt. Đây là hardening tối thiểu cần cho cổng security, có hạn chế glob được ghi doc.
- Một probe regex ban đầu chạy trực tiếp trên main Node bị treo CPU; đã xác định đúng PID probe của tác vụ và TERM. Không chạm process khác/dữ liệu. Sau đó mọi probe chạy process con timeout và SIGKILL giới hạn2s. Không lặp probe không giới hạn. Lệnh patch-commit ban đầu dùng --store-dir không được hỗ trợ, đổi --config.store-dir.
- Sau patch, pnpm auto dependency check đòi purge modules và abort vì noTTY/store khác. Chạy lại frozen install với đúng store P02 và CI=true để đồng bộ patch, không sửa node_modules bằng tay; các lệnh kiểm bị abort không được tính pass.

Hoàn tác code bằng revert task commits, không xóa DB volume/capture private. Migration0002 đã áp dụng không sửa; cần forward migration để đổi schema. Hoàn tác hardening khi chưa có thay thế tương đương sẽ khôi phục rủi ro và làm cổng high thất bại. Chưa commit/push Google credentials, không tạo billing hay hosting. Kết quả kiểm cuối/CI bổ sung bên dưới khi có thật.

### Kiểm cuối trước PR

Lint, format:check, git diff --check, unit104/104, classifier4/4, verifier patch và audit:security đều exit0. Raw audit high1/moderate1, unmitigated rỗng sau xác minh patch. Provision rerun sau sửa bảo toàn env đạt. Pnpm11 cần env pnpm_config_store_dir (npm_config không có tác dụng với wrapper hiện tại); frozen install với store đúng đạt, không đổi storeDir trong repo. Tách6 commit theo task; Google live vẫn pending, CI sẽ xác minh code cuối từ môi trường sạch.

- Bổ sung bàn giao: README vẫn mô tả P00 và thiếu migrate/seed dù code đã P03; sửa đúng các đoạn/lệnh hiện hành, dẫn runbook Google và phân biệt test provider. Đây là sửa tài liệu vận hành cần thiết, không mở rộng tính năng; không chạy lại local tests/build cho Markdown.

### CI và bàn giao cuối

Đã commit6 task (79ed3f9 T02,306d627 T04,85d2973 T01,bbf5f39 T03,f5f0ac9 T05,a4fc5f9 T06), push phase-03, tạo và attach PR #4 draft base phase-02: https://github.com/ducmanhletruong/Pharmacy-Study/pull/4. Không merge. Gitleaks36 commit không có secret. CI code a4fc5f973ca8ce808a48a4bde4072c31102d1caf run44165851119 SUCCESS: https://github.com/ducmanhletruong/Pharmacy-Study/actions/runs/44165851119. Tất cả bước frozen install/lint/format/typecheck, migrate DB rỗng/provision/seed-rerun, unit104/integration14/E2E8, production build/guard, mitigation verification/audit và gitleaks success.

Bàn giao sau CI chỉ đổi Markdown (README/handoff/status/blockers/register/worked), kiểm format/diff trực tiếp; không chạy lại local tests/build. P03 giữ LIVE GOOGLE PENDING do thiếu OAuth Web client thật; runbook cụ thể đã sẵn. Không yêu cầu approval lại cho lựa chọn lớp/Google hoặc kiểm nguồn đã duyệt. Không tự bắt đầu P04 hay suy ra quyền phân phối giáo trình cho lớp.

## 2026-11-18 — CR-0001 đánh giá rủi ro và thực hiện

Yêu cầu trực tiếp của chủ dự án cho phép triển khai đề xuất sau đánh giá. Rủi ro chính: integrity yếu làm sai grading/history; deferred trigger bắt buộc ghi revision+4choices cùng transaction, FK có thể từ chối data cũ. ADR-0012 ghi quyết định seal/lower-btrim và hạn chế DBA. Kết quả/tiến độ duy nhất ở docs/status.md; phần này ghi phát sinh.

- Tài liệu CR soạn trước P03: tạo worktree phase-02-hardening từphase-03, dùng0003 thay0002 đã áp; bảo toàn auth và role DB. Giữ CR gốc làm tham chiếu (format Markdown có thể chuẩn hóa); approval/scope ở register/ADR, không giả chữ ký người dùng vào bản gốc. Không merge theo mục3.4 vì prompt cuối CR nói không merge và các PR đã giữ draft; không chọn quy tắc by_topic còn mở.
- Plan0.1 được AGENTS yêu cầu giữ nguyên; tạo phụ lục0.2 thay việc đổi bản upload gốc. Ghi tiền điều kiện P04/P05/P12 và ngưỡng ORDER BY random, không thực hiện workflow duyệt/importer hoặc guard password P12. Production APP_ORIGIN được thực hiện trong scopeCR vì cấu hình/guard P03 đã có.
- DB reverse mới riêng chỉ chứa seed tổng hợp: trước0003 các test dự kiến đỏ đã thực sự gây thay đổi sai trên fixture. Giữ DB reverse để chứng minh migration từ chối data sai/rollback; không dùng nó cho positive tests hoặc sửa data để vượt cổng. Tạo DB verified và upgrade riêng, không xóa/tác động DB thật.
- Lượt dựng upgrade đầu dùng seed mới trước khi schema có subject_id nên42703; transaction seed rollback. Sửa đúng harness upgrade: apply0001/0002 + seed từ code trướcCR, rồi apply0003 + seed mới. Không đổi SQL/design để che lỗi. Tất cả file/env tạm được khôi phục finally, không in secret.
- Snapshot test dùng maintenance transaction và optional Db context ở getAttempt để thấy current_revision thay đổi chưa commit; rollback toàn bộ. Đây là test seam tối thiểu, tránh DISABLE TRIGGER USER trong đề xuất. Query-counter dùng cùng seam và PG thật. Tests mới chạy maint vì app_rw P03 không được sửa ngân hàng; không nới quyền runtime.
- CI mở phase-03 superset cho main/phase-* và pushmain; không kích hoạt lại job phase02 vốn dùng bootstrap cho runtime và sẽ sai với P03. Chính PR base phase-03 sẽ kiểm stacked trigger. DEV_HOST mặc định loopback, Cloud phải cấu hình explicit, không đổi server3000/DB P02 hiện hữu. Pool/payload có validate/cap để tránh NaN/zero làm vô hiệu guard. Không thêm dependency/nâng framework.
- Có một lượt lint/unit/integration bị chạy trùng do hiểu nhầm tiến trình đầu chưa hoàn tất; ghi nhận chi phí dư, không coi là coverage bổ sung hoặc lặp thêm các lượt đã đạt. Các bước tiếp theo chỉ kiểm thiếu/E2E/build và CI bắt buộc CR.
- README sửa các đoạn vẫn thiếu lệnh DB/tests và bổ sung bind config; AGENTS/handoff rút theo quy tắc nguồn trạng thái duy nhất, giữ worked append-only. Không xóa lịch sử worked.

Rollback code cần đồng bộ schema subject_id NOT NULL; không chạy down/delete_migrations trong CR trên dữ liệu thật. Thay bằng forward migration/backup review. Không deploy, đổi Windows Google session, public giáo trình hoặc tự mở phase khác.

- E2E lượt đầu không chạy được test nào vì cache thiếu Chromium headless mặc định; binary `/usr/bin/chromium` đã có nên dùng PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, không tải/cài browser mới. Không ghi tám lỗi launch đó thành lỗi hành vi sản phẩm.
- Migration trên DB reverse bị23514 như dự kiến, cả registry0003 và cột question_topics.subject_id đều không tồn tại sau thất bại, xác minh rollback DDL/registry cùng transaction. Không chỉnh data reverse để biến fail thành pass.

### Bàn giao CR-0001 sau kiểm chứng

Đã tách các commit theo nhóm docs → migration/seed → integrity tests → query/snapshot/API → CI trigger → config → docs vận hành. Push nhánh phase-02-hardening, tạo và attach PR #5 draft base phase-03. Không merge PR nào. Mọi bằng chứng và kết quả đo ở docs/status.md, bao gồm CI code cuối và giới hạn Google live riêng.

Bổ sung cuối chỉ sửa Markdown: bảng đánh giá rủi ro trong ADR-0012, canonical status, blockers/handoff và nhật ký này; kiểm format/diff, không chạy lại local tests/build vì tài liệu. Giữ handoff dưới40 dòng, không lặp số test ngoài status. Không thực hiện down SQL hoặc xóa test DB để che kết quả reverse. Cổng CR được chốt theo phạm vi đã thực hiện, các mục hoãn/OPEN vẫn nêu rõ ở status và phụ lục plan.

## 2026-11-18 — Review hiện trạng bằng đội subagent

Theo yêu cầu trực tiếp “Lập ra1 đội subagents, review code tính đến hiện tại, giả lập…”, đã lập sáu nhóm chuyên trách và root đối chiếu. Việc dùng subagent là ngoại lệ được user yêu cầu rõ trong AGENTS, không tự mở tính năng mới. Tạo worktree/branch review-current-code từ snapshot b53016d để lưu báo cáo, bảo toàn nhánh/code CR-0001. Kết quả và ưu tiên ở docs/status.md dẫn tới báo cáo review; chưa sửa logic sản phẩm hoặc tự duyệt phương án nâng cấp.

Phát sinh cần để chứng minh lỗi: agent DB tạo fixture synthetic UUID riêng, commit tạm cho hai connection quan sát được nhau, sau đó dọn đúng fixture; các probe khác rollback. Không tắt trigger/đổi schema/seed. UI dùng server riêng port3003 và Chromium có sẵn, intercept API để điều khiển response/404, không ghi DB; đã dừng process riêng. Các fault injection auth/provision chỉ dùng dữ liệu synthetic/code gốc hoặc thư viện thực tế với lỗi giả, không thao tác role thật. Agent tooling copy recorder vào /tmp và dùng capture hoàn toàn synthetic, không đọc capture/nguồn private P01. Không gọi Google/NotebookLM/OpenAI hoặc tạo chi phí dịch vụ.

Một probe callback ban đầu lỗi CJS/ESM interop, chạy lại đúng chế độ và ghi rõ không phải bug sản phẩm. Root chạy lại classifier trên malformed input để đối chiếu. Không chạy full suite/build/upgrade package; các kiểm chứng cũ được dẫn đúng nguồn, không claim là vừa chạy lại. Báo cáo phân biệt thực thi/tĩnh/fault injection, hạn chế của prototype và sự cố chưa quan sát thực tế; không suy ra capture P01 trước đây sai hoặc yêu cầu làm lại ba ngày.

Chỉ thêm báo cáo, cập nhật status/handoff và nối nhật ký này. Không push thay đổi vào PR sản phẩm, gửi comment GitHub, merge/deploy hoặc mở P04. Các probe /tmp có thể mất sau thay môi trường nên kịch bản/kết quả quan trọng được lưu bằng văn bản trong báo cáo. Có thể hoàn tác tài liệu bằng revert commit review; không có migration/code sản phẩm để rollback trong lượt này.

## 2026-11-18 — Sửa đợt1 của review

Thực hiện RV-01/RV-02 theo yêu cầu. Tạo branch fix-review-p1 trong worktree CR hiện có để dùng dependencies, bundle và DB thử sẵn, không cài thêm hoặc dùng subagent mới. Kế thừa commit review để giữ báo cáo bên cạnh bản sửa. Kết quả đo ở docs/status.md.

Migration0004 là unique expression index kiểm ngay, xử lý tranh chấp key trực tiếp trong PG thay vì chỉ count từ snapshot. Không sửa0001–0003 hoặc tắt trigger. Do duplicate bây giờ bị bắt sớm, test cũ trùng text đổi kỳ vọng23514 thành23505; không nới điều kiện dữ liệu. Thêm hai-connection regression có deadline/PGlock barrier và cleanup riêng fixture; kiểm cả commit và rollback của writer đầu, không chỉ nhận lỗi timeout.

Probe CI đọc env từ YAML thực tế và dùng production launcher/bundle cũ vì chỉ đổi SQL/tests/YAML, không đổi bundle ứng dụng. PORT3199 tránh đụng server3000, tắt process probe sau health check. Không rebuild local cho cùng app code đã build. Không nâng toolchain/dependency. Phát sinh liên quan được ghi rõ: unique immediate hạn chế text swap tạm trùng và B-tree giới hạn kích thước key; không tự thêm normalization hash hoặc thay thiết kế nội dung để mở rộng phạm vi.

Các sửa fault-handling/logout/UI/recorder/taxonomy vẫn chưa làm. Hoàn tác index bằng forward migration được review nếu cần, không sửa hash migration đã áp; revert code phải đồng bộ assertion/test. Không merge/deploy hoặc đổi dữ liệu private/NotebookLM.

Bàn giao sau CI: đã push nhánh fix-review-p1, tạo và attach PR #6 draft, chưa merge. CI code đã kiểm và các kết quả ở docs/status.md; không khẳng định workflow main đã được chạy qua GitHub. Bổ sung cuối chỉ đổi Markdown để đóng RV-01/RV-02 và ghi bàn giao; không chạy lại local tests/build cho tài liệu. Không mở các phần sửa P2/P3.

## 2026-11-18 — Sửa đợt2 phục hồi và bảo mật

Theo yêu cầu trực tiếp, tạo branch fix-review-recovery-security từ fix-review-p1, chỉ xử lý các finding thuộc đợt2. Không dùng thêm subagent, dependency hoặc dịch vụ bên ngoài. Các kết quả và trạng thái ở docs/status.md; report gốc giữ evidence snapshot.

Phát sinh cần thiết: NextAuth nuốt lỗi signOut event nên route wrapper giữ cờ lỗi và bỏ response thư viện khi revoke chưa thành công; giữ nguyên CSRF/cookie strategy. UI dùng fetch logout có CSRF và kiểm redirect thay việc signOut tự điều hướng dù503. Thêm signed rate-client cookie và cap global lớn hơn; không giả IP client qua header. Identity error chuyển false/public denial để raw exception không đi vào callback URL. Thêm deadline đọc body10s vì body được kiểm trước quota, tránh request treo giữ tài nguyên vô hạn; test stream không gửi byte xác nhận408/cancel.

Provision cần tách core CLI sang provision-local để test fault injection tại DB/FS mà không làm hỏng role thật. Journal private sync trước CREATE ROLE, DDL transaction, existing credential probe trước grant, file atomic/mode600. Ghi .env.db trước .env để lỗi IO không làm mất đường bootstrap khi runtime URL đã đổi. Temp file đặt .env.write-* để nếu process chết cũng bị Git ignore. Journal/lock private không vào web runtime; khi stale phải operator kiểm không còn CLI trước xóa lock, không auto xoay role password.

Recorder dùng mkdir lock cùng private capture, bounded wait và release finally. Không auto xóa lock theo tuổi vì có thể xóa lock của writer còn sống; runbook hướng dẫn stale recovery. Năm CLI test dùng synthetic data giữ mọi observation, không đọc private P01 hoặc gọi NotebookLM. Audit classifier validate schema/count, wrapper kiểm exit code; không mở ngoại lệ advisory mới hay giả raw audit về0.

Test auth route ban đầu đặt trong core không resolve Next dependency theo pnpm strict; chuyển đúng vị trí web và thêm Vitest include web server tests, không thêm dependency core. Lint cảnh báo ref cleanup đã sửa bằng callback ổn định, bỏ unused import. Lượt E2E đầu HMR reload vòng khi dùng cache cũ: dừng đúng runner, chỉ xóa .next/dev cache sinh tự động; ca login sau cache sạch đạt. E2E error selector ban đầu trùng Next route announcer: sửa selector app error, thêm chờ response thực sự xong cho stale-response regression. Không đánh dấu các lượt timeout/interrupted là pass; không chạy lặp fullsuite khi không đổi logic.

CI cần nhận PR base fix-* (base đợt1 không còn phase-*), nên mở trigger tương ứng; thêm recorder tests nhẹ vào job hiện hành để PR này không bỏ qua hồi quy tooling. Đây là sửa cổng cần thiết cho scope, không hợp nhất/nâng cấp toolchain. Không sửa migration hoặc các finding đợt3; rollback bằng revert code phù hợp, bảo toàn journal private đến khi provision hoàn tất.

Bàn giao cuối đợt2: đã push năm commit theo nhóm auth/UI, provision, tooling, runbook và fixture test không phụ thuộc origin CI main; tạo và attach PR #7 draft base fix-review-p1. CI code cuối đạt, bằng chứng/giới hạn và các finding còn mở ở docs/status.md. Gitleaks local và CI đều không phát hiện secret; không thay raw advisory count thành0. Bổ sung sau CI chỉ sửa Markdown, kiểm format/diff và không chạy lại local suite/build. Chưa merge/deploy hoặc sửa đợt3; không suy rằng Google OAuth thật đã được kiểm.

## 2026-11-18 — Đợt3 theo kế hoạch review

Sau yêu cầu tiếp Plan, đối chiếu cổng cho thấy P03 Google live còn mở; thực hiện đợt3 review, không mở workflow P04. Dùng lại ba thành viên đội đã được user yêu cầu để sửa các vùng file độc lập DB, contract/evaluator và dropdown; không spawn agent mới. Root xem SQL trước apply và tổng hợp kiểm chứng ở docs/status.md.

Phát sinh cần thiết: ledger seal và real write-version lock rows tránh stale snapshot ở RR, thay việc chỉ đọc/advisory lock; SECDEF ownership/search_path/execute ACL được giới hạn. Snapshot tạo ở BEFORE INSERT attempt item và chặn đổi identity/snapshot sau đó; legacy chỉ backfill trạng thái còn quan sát được và không sửa result đã nộp. Dọn fixture dùng rollback hoặc DELETE hợp lệ, không tắt guards. Test seam optional DB context cho create/submit chỉ nhận từ code nội bộ/test, HTTP không lấy từ payload.

API tree phát hiện component không reachable thay vì bỏ im lặng; dropdown flatten đệ quy không lồng optgroup. Result contract thêm bounds từngtopic/uniqueID nhưng không ép tổng topic bằng tổng bài, giữ OPEN quy tắc multi-topic. Evaluator validate fixture trước cả prompts/self-check, testCLI dùng temp copies không sửa fixture chuẩn hoặc gọi provider. CI job hiện hành thêm evaluator test/self-check cơ học, không chạy inference hoặc nâng toolchain.

Migration0005 đã áp giữ nguyênchecksum; không sửa migration cũ. Runbook data-history ghi rõ giới hạn lịch sử legacy và retry cả transaction40001/40P01. Không tự seal mọi draft legacy, không fabricate topic lịch sử. Chưa commit/push/mở phase khác ở thời điểm ghi này; trạng thái/kiểm chứng tiếp theo ghi ở status.

Kiểm local chung đã chạy sau khi các vùng code được freeze. E2E topic-depth đầu dùng getByLabel exact không khớp text của label chứa options; đổi sang role combobox/accessiblename, kiểm lại đúng thứ tự/nội dung/ID và POST. Không tăng timeout hoặc bỏ assertion. Chỉ ca bị ảnh hưởng được chạy lại, không chạy lặp fullsuite. CI sẽ build vì dropdown và contract dùng trong bundle web đã thay đổi; không build local thêm cho cùng code.

Root review cuối phát hiện BEFORE INSERT chưa thấy NEWrow có thể bỏ lọt cycle khi một statement INSERT nhiều topic. Agent tái hiện hai/ba node bằng rollback-only test; thêm0006 và9test lịch sử đạt sau sửa, giữ0005 checksum vì đã áp. Đây là phát sinh kiểm chứng trong scopeRV10, không mở tính năng mới hoặc đổi dữ liệu để vượt cổng. Bản sửa xét cả ancestor.id và ancestor.parent_id trỏNEW.id;0006 cũng preflight dữ liệu đang có.

Bàn giao cuối: đã commit/push theo nhóm DB history, contracts/evaluator/dropdown, runbook và forward bulk-cycle correction; tạo/attach PR #8 draft base đợt2. CI code cuối thành công; mọi bằng chứng và giới hạn ở docs/status.md. Bổ sung cuối chỉ Markdown và kiểm format/diff, không chạy lại local suite/build. Không đóng Google live hoặc mở workflow P04; không merge/deploy.

## 2026-11-19 — P04 vòng đời nội dung

User yêu cầu trực tiếp “làm PO4 đi”. Tạo nhánh phase-04 từ fix-review-data-completion trong worktree CR sẵn có, bảo toàn server/DB P02 cũ. Yêu cầu này cho phép triển khai P04 local dù P03 Google live chưa kiểm; cập nhật decision-register/blockers, không ghi P03 DONE. Dùng lại các thành viên của đội review đã được user yêu cầu để chia phần contract/lifecycle, DB/service, asset và UI; không tạo đội mới. Root tích hợp HTTP/guards/practice/CI/docs và kiểm kết quả. Không clone repo ngoài vì dependencies hiện có đủ; không gọi Google/NotebookLM/OpenAI, không lấy giáo trình, không tạo hosting.

Các điều chỉnh cần thiết so với đường dẫn/đặc tả minh họa trong plan: bundle JSON profile1 MCQ dùng alias source/asset và asset base64 trong một file thay ZIP hay đường dẫn file; API schema đặt dưới src/bundle theo layout package hiện có. API admin dùng app/admin hiện có thay thêm route group. MAX_IMPORT_BYTES mặc định5MiB, cho cấu hình tối đa50MiB; body helper nhận giới hạn riêng chỉ từ server route, giữ giới hạn cũ cho API khác. File example env chỉ chứa giá trị công khai. CLI kiểm schema/tham chiếu, không tự tuyên bố bytes ảnh an toàn; importer kiểm lại trước ghi DB.

Asset private lưu bytea trong DB local, storage_key dạng db:hash thay object storage chưa được chọn. Cần saxes6.0.0 để parse XML an toàn và sharp0.35.5 để kiểm magic/decode/reencode raster; sharp đã có transitively từ Next nhưng thêm direct dependency DB. pnpm install cập nhật manifest/lock cần thiết, không nâng nền tảng. SVG giới hạn hình học tĩnh và từ chối script/URL/DTD/style; raster bỏ metadata, có cap bytes/pixel/frame. Ảnh cùng SHA khác provenance bị409 bảo thủ, runbook ghi rõ. Nếu đổi storage về sau cần adapter/migration có review, không làm trong lượt này.

Migration0007 được review/fix thứ tự lock trước khi áp DB verified; sau áp giữ nguyên checksum. Runtime nhận thêm quyền ghi bank tối thiểu cho admin service nhưng không được sửa/xóa audit hoặc DDL; nguồn/asset/provenance có gate DB, seed bypass giới hạn maintenance + môn synthetic. Fixture history/integrity cũ được bổ sung source approved và bước verified vì gate mới, không tắt trigger hoặc nới assertion. Service recheck admin cả trước decode asset lẫn trong transaction, tạo tên subject mới từ manifest.label; source fingerprint đã có tái sử dụng review cũ. Không đổi tên môn đã tồn tại. Dedupe hashes giữ cả revision lịch sử, nên nhập/sửa về nội dung hash đã tồn tại trả409 để admin đối chiếu.

Practice bổ sung descriptors ảnh authenticated và form báo lỗi, cho chọn1–10 câu để dùng bank mới có ít hơn5 câu; giữ chấm MCQ/ownership/idempotency. UI báo lỗi giới hạn note2000 đúng HTTP schema. Root phát hiện ở E2E lượt đầu ảnh/form bị đặt trong h2, làm accessible heading lẫn nội dung; đã đưa ra ngoài heading, không đổi assertion để che lỗi. E2E dùng môn/nguồn/ảnh bytes riêng từng run để tránh trùng SHA/provenance và không làm lệch seed10 câu cũ. Dữ liệu đều synthetic; không xóa bài người dùng hoặc volume.

CI mở rộng job phase-03 superset sẵn có với content:validate; unit/integration/E2E tự nhận test P04, tránh thêm job trùng đầy đủ. Build phục vụ kiểm native image dependency, routes mới và acceptance phase; không build sau từng chỉnh sửa. Kết quả chính thức chỉ ở docs/status.md. Tài liệu bàn giao gọn, runbook có thu hồi các câu mới thuộc import_id bằng maintenance transaction review; chưa thêm UI thu hồi hàng loạt. Không down migration/sửa registry. Hoàn tác cần revert code có xem xét schema và forward migration; import lỗi tự rollback, câu phát hành sai chuyển under_review. Không merge/deploy hoặc tự mở P05.

Đã commit theo T01–T06, push phase-04 và tạo/attach PR #9 draft base fix-review-data-completion. CI code cuối đạt, bằng chứng ở docs/status.md. Lượt cuối chỉ bổ sung Markdown status/handoff/nhật ký sau khi đọc job logs; không chạy lại local tests/build cho tài liệu. Dừng cổng P04, không tự mở P05 hoặc coi Google live đã hoàn tất.

## 2026-11-19 — Bỏ whitelist học viên, thêm phiên ẩn danh

Theo yêu cầu trực tiếp của user, tạo branch feat-open-access từ phase-04. Đây là thay đổi phạm vi truy cập so với Q3/ADR-0008 cũ, không tự mở P05. Cập nhật ADR/decision-register/runbook: Google verified email vào học không cần INVITED_EMAILS; ADMIN_EMAILS chỉ cấp admin, được để trống. Bỏ đọc/validate biến mời cũ để cấu hình legacy không còn chặn người học; helper membership đổi tên tối thiểu thành loginRole theo ý nghĩa mới. Không thay Google OAuth client, không gọi Google thật hoặc sửa private env của user.

Dùng lại NextAuth credentials flow với provider guest: authorize bỏ qua toàn bộ credential do client gửi, sinh UUID/email nội bộ riêng, role learner được ép ở callback và DB service. Mở thêm AUTH_MODE=guest để dùng không cần OAuth credentials; oidc cho Google và guest. Bổ sung mode vào auth route/start/dev/instrumentation/Origin để giữ guard DB ít quyền, HTTPS production và secret session. Guest không dùng DEV_USER_ID chung. Session vẫn JWT HttpOnly + DB revoke, tối đa8 giờ; không tự merge vào Google hoặc khôi phục sau logout/mất cookie, không thêm cleanup/retention ngoài scope. Global auth quota hiện có vẫn bảo vệ tạo guest nhưng không tuyên bố chống bot theo người thật.

Migration0008 chỉ mở constraint provider cho guest, không sửa0001–0007 hoặc xóa dữ liệu. Áp lên DB verified hiện có. Audit whitelist thêm guest/denial reason mới, không ghi credentials/token. UI login bỏ nội dung “chỉ được mời”, thêm nút ẩn danh và giải thích giới hạn phiên. Không thêm dependency/lockfile upgrade, subagent, hosting hoặc nguồn giáo trình. Quyền mở truy cập không cho phép công khai tài liệu có bản quyền.

Kiểm mục tiêu auth/config/DB và browser; bổ sung ca Google verified ngoài danh sách, unverified/disabled, guest fake identity/admin, hai guest không dùng chung bài, reload/resume, CSRF và logout token replay. Test Google là callback mock, không gắn nhãn Google live. Unit đầu chỉnh helper fixture để phân biệt missing verified flag với giá trị mặc định true, đọc id override trong options của Credentials trước bước NextAuth normalize; sửa type assertion union Session trong test, không nới assertion hành vi. E2E đầu gặp cache dev cũ làm HMR reload liên tục, trace không hoàn tất login; dừng đúng process test, xóa duy nhất apps/web/.next/dev được sinh tự động rồi kiểm lại. Không xóa DB, session hoặc tăng timeout để che lỗi.

Playwright bỏ danh sách mời synthetic không còn dùng, thêm E2E_GUEST_ONLY để kiểm entry path không Google credentials/admin emails; CI thêm đúng luồng guest-only này cạnh suite sẵn có. CI sẽ build vì entry/instrumentation/auth runtime thay đổi; không build local lặp với CI. Kết quả và PR ở docs/status.md. Rollback phải xét chính sách user đã chọn: revert code có review/khôi phục cấu hình cũ nếu muốn đóng truy cập, giữ dữ liệu/registry; đổi schema chỉ forward migration, không sửa checksum hoặc xóa guest histories tùy tiện.

Rà soát diff sau commit phát hiện script cập nhật tài liệu đã ghi nhầm nội dung example env vào docs/status.md. Đã khôi phục nguyên lịch sử từ base phase-04 và bổ sung đúng mục truy cập mới, ghi correction bằng commit riêng, không rewrite lịch sử Git đã push. Chỉ nội dung example công khai bị ghi nhầm, không có private env/secret. Kiểm lại diff và format tài liệu; không cần chạy lại test logic cho correction này.
