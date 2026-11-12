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
