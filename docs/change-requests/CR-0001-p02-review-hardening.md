# CR-0001 — Củng cố toàn vẹn dữ liệu và sửa lỗi tồn đọng sau P02

- Ngày: 2026-11-18
- Người đề xuất: review sau P02 (Claude), cần chủ dự án duyệt
- Trạng thái: **PROPOSED**
- Người duyệt: chủ dự án; agent không tự duyệt.
- Nhánh đề xuất: `phase-02-hardening` (tách từ `phase-02`), không mở P03.

> **Lưu ý kiểm chứng.** SQL, test và YAML bên dưới chưa được chạy (môi trường soạn thảo không có PostgreSQL, Docker hay mạng). Codex phải chạy đủ chuỗi kiểm chứng ở mục 7 và báo kết quả thật. Gặp lỗi thì dừng, ghi `docs/blockers.md`, không tự đổi hướng.

## 1. Thay đổi và lý do

| #   | Vấn đề (mức)                                                                            | Giải pháp                                                                           | Mục |
| --- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --- |
| 1   | MCQ hợp lệ chỉ kiểm ở seed, DB không ép (Cao)                                           | Constraint trigger hoãn: đủ 4 lựa chọn, đúng 1 đáp án đúng, nội dung không trùng    | 3.1 |
| 2   | Câu đã duyệt hoặc đã được làm vẫn sửa tại chỗ được (Cao)                                | Trigger chặn UPDATE/DELETE revision và lựa chọn đã "niêm phong"                     | 3.1 |
| 3   | Chưa có luồng duyệt thật (Cao)                                                          | **Không sửa ở CR này.** Đã nằm ở P04-T03; chỉ thêm tiền điều kiện (mục 5)           | 5   |
| 4   | Chủ đề có thể thuộc môn khác với câu hỏi (TB)                                           | Khóa ngoại tổng hợp `(question_id, subject_id)` và `(topic_id, subject_id)`         | 3.1 |
| 5   | `readAttempt` truy vấn N+1 (TB)                                                         | Gộp một truy vấn                                                                    | 3.2 |
| 6   | `ORDER BY random()` (TB)                                                                | Chưa sửa; ghi ngưỡng xem lại                                                        | 5   |
| 7   | Origin dựa vào `Host`, dev bind `0.0.0.0` (TB)                                          | Tiền điều kiện P03 và biến `DEV_HOST`                                               | 3.5, 5 |
| 8   | CI `phase-02.yml` chỉ chạy khi PR vào `main` hoặc `phase-01` (TB)                       | Mở rộng trigger, gộp PR vào `main`                                                  | 3.4 |
| 9   | Test thưa (TB)                                                                          | Thêm test DB và bổ sung test API                                                    | 3.3 |
| 10  | Mật khẩu dev có thể lọt lên production (TB)                                             | Guard khởi động production, làm ở P12                                               | 5   |
| 11  | `minimatch` moderate (TB)                                                               | Theo dõi, không đổi                                                                 | 5   |
| 12  | Hằng số ghi cứng (Thấp)                                                                 | Đưa ra biến môi trường                                                              | 3.5 |
| 13  | Tài liệu trạng thái lặp (Thấp)                                                          | Quy tắc một nguồn sự thật                                                           | 3.6 |
| 14  | README lỗi thời (Thấp)                                                                  | Viết lại các đoạn liên quan                                                         | 3.6 |

## 2. Quyết định thiết kế (để chủ dự án duyệt)

1. **Chỉ thêm migration `0002`, không sửa `0001`.** `migrate.ts` từ chối migration đã áp dụng mà hash đổi.
2. **Niêm phong revision.** Một revision bị niêm phong (không sửa/xóa được) khi: (a) đã có `attempt_items` trỏ tới; hoặc (b) câu hỏi chủ không còn ở trạng thái `draft`; hoặc (c) nó đã bị revision mới thay thế. Revision của câu `draft` đang là bản hiện hành, chưa ai làm, vẫn sửa được. Phù hợp P04: "sửa nội dung tạo revision mới".
3. **Không chặn INSERT vào `question_choices`.** Seed dùng `INSERT ... ON CONFLICT DO NOTHING`; trigger BEFORE INSERT chạy trước khi kiểm xung đột nên sẽ làm seed chạy lại bị lỗi. Không cần chặn: khóa chính `(revision_id, label)` với `label IN ('A','B','C','D')` đã giới hạn tối đa 4 dòng, và kiểm tra hoãn bắt thiếu/thừa.
4. **Kiểm tra "trùng nội dung" ở DB dùng `lower(btrim(text))`.** Tầng ứng dụng (`validateChoices`) chặt hơn (chuẩn hóa NFC, `toLocaleLowerCase('vi')`). DB là lưới an toàn cuối, không thay thế tầng ứng dụng.
5. **Rollback `0002` làm thủ công** (mục 4), vì `migrate.ts` chưa hỗ trợ down.

## 3. Nội dung cần chỉnh sửa

### 3.1 Tạo `packages/db/migrations/0002_integrity_hardening.sql`

```sql
-- 0002: toàn vẹn MCQ, niêm phong revision, nhất quán môn học của chủ đề.
-- Chỉ thêm đối tượng mới; không sửa 0001.

-- ===== A. MCQ hợp lệ: đủ 4 lựa chọn, đúng 1 đáp án đúng, nội dung khác nhau =====
CREATE FUNCTION assert_mcq_revision(rev uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  n_total int;
  n_correct int;
  n_distinct int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM question_revisions WHERE id = rev) THEN
    RETURN; -- revision đã bị xóa trong cùng transaction
  END IF;
  SELECT count(*),
         count(*) FILTER (WHERE is_correct),
         count(DISTINCT lower(btrim(text)))
    INTO n_total, n_correct, n_distinct
    FROM question_choices
   WHERE revision_id = rev;
  IF n_total <> 4 OR n_correct <> 1 OR n_distinct <> 4 THEN
    RAISE EXCEPTION
      'MCQ revision % needs 4 distinct choices and exactly 1 correct (choices=%, correct=%, distinct=%)',
      rev, n_total, n_correct, n_distinct
      USING ERRCODE = 'check_violation';
  END IF;
END $$;

CREATE FUNCTION check_choice_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN PERFORM assert_mcq_revision(OLD.revision_id); END IF;
  IF TG_OP <> 'DELETE' THEN PERFORM assert_mcq_revision(NEW.revision_id); END IF;
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER question_choices_valid
  AFTER INSERT OR UPDATE OR DELETE ON question_choices
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_choice_change();

CREATE FUNCTION check_revision_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  PERFORM assert_mcq_revision(NEW.id); -- revision không có lựa chọn cũng bị từ chối
  RETURN NULL;
END $$;

CREATE CONSTRAINT TRIGGER question_revisions_valid
  AFTER INSERT ON question_revisions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION check_revision_insert();

-- Kiểm dữ liệu đang có; sai thì migration thất bại và rollback toàn bộ.
DO $$
DECLARE r uuid;
BEGIN
  FOR r IN SELECT id FROM question_revisions LOOP
    PERFORM assert_mcq_revision(r);
  END LOOP;
END $$;

-- ===== B. Niêm phong revision =====
-- VOLATILE (mặc định) để thấy thay đổi trước đó trong cùng transaction.
CREATE FUNCTION revision_is_sealed(rev uuid) RETURNS boolean
LANGUAGE sql AS $$
  SELECT EXISTS (SELECT 1 FROM attempt_items WHERE question_revision_id = rev)
      OR EXISTS (
        SELECT 1
          FROM question_revisions r
          JOIN questions q ON q.id = r.question_id
         WHERE r.id = rev
           AND (q.status <> 'draft'
                OR (q.current_revision_id IS NOT NULL AND q.current_revision_id <> r.id))
      );
$$;

CREATE FUNCTION guard_sealed_revision() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF revision_is_sealed(OLD.id) THEN
    RAISE EXCEPTION 'question_revisions % is sealed; create a new revision instead', OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER question_revisions_guard
  BEFORE UPDATE OR DELETE ON question_revisions
  FOR EACH ROW EXECUTE FUNCTION guard_sealed_revision();

CREATE FUNCTION guard_sealed_choice() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF revision_is_sealed(OLD.revision_id) THEN
    RAISE EXCEPTION 'choices of revision % are sealed; create a new revision instead', OLD.revision_id
      USING ERRCODE = 'restrict_violation';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER question_choices_guard
  BEFORE UPDATE OR DELETE ON question_choices
  FOR EACH ROW EXECUTE FUNCTION guard_sealed_choice();

-- ===== C. Chủ đề phải cùng môn với câu hỏi =====
ALTER TABLE questions
  ADD CONSTRAINT questions_id_subject_key UNIQUE (id, subject_id);

ALTER TABLE question_topics ADD COLUMN subject_id uuid;
UPDATE question_topics qt
   SET subject_id = q.subject_id
  FROM questions q
 WHERE q.id = qt.question_id;
ALTER TABLE question_topics ALTER COLUMN subject_id SET NOT NULL;

ALTER TABLE question_topics
  ADD CONSTRAINT question_topics_question_subject
  FOREIGN KEY (question_id, subject_id) REFERENCES questions (id, subject_id);
ALTER TABLE question_topics
  ADD CONSTRAINT question_topics_topic_subject
  FOREIGN KEY (topic_id, subject_id) REFERENCES topics (id, subject_id);
```

**Sửa `packages/db/src/seed.ts`** (bắt buộc, vì cột `subject_id` mới là `NOT NULL`). Thay đoạn chèn `question_topics`:

```ts
// Trước
await client.query(
  'INSERT INTO question_topics(question_id,topic_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
  [qid, id(2, fixture.topic + 1)],
)

// Sau
await client.query(
  'INSERT INTO question_topics(question_id,topic_id,subject_id) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',
  [qid, id(2, fixture.topic + 1), id(1, 1)],
)
```

Thứ tự trong seed hiện tại (revision → lựa chọn → chuyển `approved`) vẫn hợp lệ với trigger mới vì các trigger kiểm tra hoãn tới COMMIT và seed chạy trong một transaction.

### 3.2 Gộp truy vấn N+1 trong `packages/db/src/practice.ts`

Trong `readAttempt`, thay truy vấn `attempt_items` và vòng lặp `for (const row of result.rows)` bằng:

```ts
const result = await db.query<{
  position: number
  question_id: string
  revision_id: string
  stem: string
  answer: Label | null
  flagged: boolean
  choices: { label: Label; text: string }[]
}>(
  `SELECT i.position, r.question_id, r.id AS revision_id, r.stem, i.answer, i.flagged,
          (SELECT json_agg(json_build_object('label', c.label, 'text', c.text) ORDER BY c.label)
             FROM question_choices c WHERE c.revision_id = r.id) AS choices
     FROM attempt_items i
     JOIN question_revisions r ON r.id = i.question_revision_id
    WHERE i.attempt_id = $1
    ORDER BY i.position`,
  [id],
)
return attemptSchema.parse({
  id,
  subject: subject.rows[0]?.code,
  mode: 'practice',
  status: attempt.status,
  items: result.rows,
})
```

Hành vi giữ nguyên: `attemptSchema` vẫn `.strict()`, không có `is_correct`, `explanation`, `sources`. Test "redact answers" hiện có phải vẫn đạt không sửa.

### 3.3 Test

**(a) Sửa test hiện có** `attempts remain attached to the original revision if current revision changes` trong `tests/integration/practice.test.ts`. Lý do: revision tạm không có lựa chọn sẽ bị trigger mới từ chối, và việc xóa revision của câu đã duyệt cũng bị chặn. Thay toàn bộ test bằng:

```ts
async function withoutGuards(run: (client: PoolClient) => Promise<void>) {
  // Chỉ dùng để dọn dữ liệu test: tắt trigger người dùng trong một transaction.
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query('ALTER TABLE question_revisions DISABLE TRIGGER USER')
    await client.query('ALTER TABLE question_choices DISABLE TRIGGER USER')
    await run(client)
    await client.query('ALTER TABLE question_revisions ENABLE TRIGGER USER')
    await client.query('ALTER TABLE question_choices ENABLE TRIGGER USER')
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
test('attempts remain attached to the original revision if current revision changes', async () => {
  const { value: attempt } = await newAttempt(randomUUID(), { count: 1 })
  const item = attempt.items[0],
    rid = randomUUID()
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await client.query(
      "INSERT INTO question_revisions(id,question_id,rev_no,stem,explanation,content_hash,created_by) VALUES($1,$2,999,'temporary revision','test-only',$3,$4)",
      [rid, item.question_id, randomUUID(), DEV_USER_ID],
    )
    for (const [label, correct] of [['A', true], ['B', false], ['C', false], ['D', false]] as const)
      await client.query(
        'INSERT INTO question_choices(revision_id,label,text,is_correct) VALUES($1,$2,$3,$4)',
        [rid, label, `temporary ${label}`, correct],
      )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
  try {
    await getPool().query(
      'UPDATE questions SET current_revision_id=$1 WHERE id=$2',
      [rid, item.question_id],
    )
    const after = (await getAttempt(attempt.id, DEV_USER_ID)).items[0]!
    expect(after.revision_id).toBe(item.revision_id)
    expect(after.stem).toBe(item.stem)
  } finally {
    await getPool().query(
      'UPDATE questions SET current_revision_id=$1 WHERE id=$2',
      [item.revision_id, item.question_id],
    )
    await withoutGuards(async (c) => {
      await c.query('DELETE FROM question_choices WHERE revision_id=$1', [rid])
      await c.query('DELETE FROM question_revisions WHERE id=$1', [rid])
    })
  }
})
```

Thêm vào đầu file: `import type { PoolClient } from 'pg'`. Nếu `pg` không resolve được từ thư mục gốc (pnpm nghiêm ngặt), dùng `type PoolClient = Awaited<ReturnType<ReturnType<typeof getPool>['connect']>>`.

**(b) Tạo mới `tests/integration/db-integrity.test.ts`:**

```ts
import { loadLocalEnv } from '../../packages/db/src/env'
import { randomUUID } from 'node:crypto'
import { afterAll, expect, test } from 'vitest'
import { DEV_USER_ID, getPool, closeDb } from '../../packages/db/src/client'

loadLocalEnv()
afterAll(closeDb)

type Client = Awaited<ReturnType<ReturnType<typeof getPool>['connect']>>
const labels = ['A', 'B', 'C', 'D']

async function seeded() {
  const result = await getPool().query<{
    id: string
    subject_id: string
    current_revision_id: string
  }>("SELECT id,subject_id,current_revision_id FROM questions WHERE status='approved' LIMIT 1")
  return result.rows[0]!
}
async function addRevision(
  client: Client,
  questionId: string,
  revNo: number,
  texts: string[],
  correct: string[],
) {
  const rid = randomUUID()
  await client.query(
    "INSERT INTO question_revisions(id,question_id,rev_no,stem,explanation,content_hash,created_by) VALUES($1,$2,$3,'test stem','test-only',$4,$5)",
    [rid, questionId, revNo, randomUUID(), DEV_USER_ID],
  )
  for (const [i, label] of labels.entries())
    await client.query(
      'INSERT INTO question_choices(revision_id,label,text,is_correct) VALUES($1,$2,$3,$4)',
      [rid, label, texts[i], correct.includes(label)],
    )
  return rid
}
// Mọi thay đổi trong test này luôn bị ROLLBACK; không để lại dữ liệu.
async function rolledBack(run: (client: Client) => Promise<unknown>) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    await run(client)
  } finally {
    await client.query('ROLLBACK')
    client.release()
  }
}

test('a revision without choices cannot be committed', async () => {
  const q = await seeded()
  await expect(
    getPool().query(
      "INSERT INTO question_revisions(id,question_id,rev_no,stem,explanation,content_hash,created_by) VALUES($1,$2,998,'no choices','test-only',$3,$4)",
      [randomUUID(), q.id, randomUUID(), DEV_USER_ID],
    ),
  ).rejects.toMatchObject({ code: '23514' })
})

test('a revision with no correct choice is rejected at commit', async () => {
  const q = await seeded()
  await expect(
    rolledBack(async (client) => {
      await addRevision(client, q.id, 997, ['a1', 'b1', 'c1', 'd1'], [])
      await client.query('SET CONSTRAINTS ALL IMMEDIATE')
    }),
  ).rejects.toMatchObject({ code: '23514' })
})

test('duplicate choice texts are rejected at commit', async () => {
  const q = await seeded()
  await expect(
    rolledBack(async (client) => {
      await addRevision(client, q.id, 996, ['same', ' SAME ', 'c1', 'd1'], ['A'])
      await client.query('SET CONSTRAINTS ALL IMMEDIATE')
    }),
  ).rejects.toMatchObject({ code: '23514' })
})

test('a second correct choice is rejected by the unique index', async () => {
  const q = await seeded()
  await expect(
    rolledBack((client) =>
      addRevision(client, q.id, 995, ['a1', 'b1', 'c1', 'd1'], ['A', 'B']),
    ),
  ).rejects.toMatchObject({ code: '23505' })
})

test('choices and revisions of an approved question are sealed', async () => {
  const q = await seeded()
  await expect(
    getPool().query(
      "UPDATE question_choices SET text='changed' WHERE revision_id=$1 AND label='A'",
      [q.current_revision_id],
    ),
  ).rejects.toMatchObject({ code: '23001' })
  await expect(
    getPool().query("UPDATE question_revisions SET explanation='changed' WHERE id=$1", [
      q.current_revision_id,
    ]),
  ).rejects.toMatchObject({ code: '23001' })
  await expect(
    getPool().query('DELETE FROM question_choices WHERE revision_id=$1', [
      q.current_revision_id,
    ]),
  ).rejects.toMatchObject({ code: '23001' })
})

test('a draft revision stays editable until the question leaves draft', async () => {
  const q = await seeded()
  await rolledBack(async (client) => {
    const question = randomUUID()
    await client.query(
      "INSERT INTO questions(id,subject_id,type,difficulty,status) VALUES($1,$2,'mcq',1,'draft')",
      [question, q.subject_id],
    )
    const rid = await addRevision(client, question, 1, ['a1', 'b1', 'c1', 'd1'], ['A'])
    await client.query('UPDATE questions SET current_revision_id=$1 WHERE id=$2', [rid, question])
    await client.query("UPDATE question_revisions SET explanation='edited' WHERE id=$1", [rid])
    await client.query("UPDATE questions SET status='verified' WHERE id=$1", [question])
    await expect(
      client.query("UPDATE question_revisions SET explanation='edited again' WHERE id=$1", [rid]),
    ).rejects.toMatchObject({ code: '23001' })
  })
})

test('a topic from another subject cannot be linked to a question', async () => {
  const q = await seeded()
  await expect(
    rolledBack(async (client) => {
      const subject = randomUUID(),
        topic = randomUUID()
      await client.query(
        "INSERT INTO subjects(id,code,name) VALUES($1,$2,'other')",
        [subject, `tmp-${subject}`],
      )
      await client.query(
        "INSERT INTO topics(id,subject_id,parent_id,code,title) VALUES($1,$2,NULL,'x','x')",
        [topic, subject],
      )
      await client.query(
        'INSERT INTO question_topics(question_id,topic_id,subject_id) VALUES($1,$2,$3)',
        [q.id, topic, q.subject_id],
      )
    }),
  ).rejects.toMatchObject({ code: '23503' })
})
```

Ghi chú cho Codex: test thứ hai và thứ ba dùng `SET CONSTRAINTS ALL IMMEDIATE` để ép kiểm tra hoãn chạy trước `ROLLBACK` (nếu không, transaction bị hủy mà trigger hoãn chưa kịp chạy và test sẽ xanh giả).

**(c) Test API bổ sung** (thêm vào `tests/integration/practice.test.ts`, dùng các helper `newAttempt`, `req`, `answer`, `submit`, `context` đã có; đọc test cũ để khớp chữ ký trước khi viết):

| Tên test                          | Các bước                                                                            | Kỳ vọng pass/fail                                                      |
| --------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| submit với câu bỏ trống           | Tạo bài 10 câu, trả lời 3 câu (đúng 2), nộp                                         | `total=10`, `correct=2`, `unanswered=7`, `score=2.0`                   |
| nộp bài không trả lời câu nào     | Tạo bài, nộp ngay                                                                   | `correct=0`, `unanswered=10`, `score=0`, status 200                    |
| giới hạn `count`                  | POST `count=0` rồi `count=11`                                                       | Cả hai 400 `validation_failed`, không tạo `attempts` mới               |
| `count` vượt số câu có sẵn        | Ẩn tạm câu hỏi (trong test, khôi phục sau) hoặc lọc `difficulty` không có câu       | 422 `insufficient_questions`, không có dòng `attempts` mới             |
| payload quá lớn                   | POST body lớn hơn giới hạn                                                          | 413 `payload_too_large`                                                |

Câu hỏi mở cho chủ dự án: nếu một câu gắn nhiều chủ đề thì `by_topic` hiện cộng câu đó vào **mỗi** chủ đề (tổng `by_topic` có thể lớn hơn `total`). Chưa có test cho trường hợp này vì chưa có quy tắc được duyệt; cần quyết định trước khi viết (xem mục 5).

### 3.4 CI: `.github/workflows/phase-02.yml`

```yaml
# Trước
on:
  pull_request:
    branches: [main, phase-01]

# Sau
on:
  pull_request:
    branches: [main, 'phase-*']
  push:
    branches: [main]
```

Thêm bước kiểm tra schema sau seed lặp (giúp phát hiện migration bị sửa): giữ nguyên bước `db:migrate && db:seed && db:migrate && db:seed` hiện có, không cần thêm. Sau khi gộp PR, `ci.yml` (P00) và `phase-02.yml` cùng chạy trên `main`; chấp nhận trùng lặp đến khi có `quality.yml` hợp nhất ở P12.

**Gộp PR xếp chồng** (làm trên GitHub, theo thứ tự): merge PR #1 (P00) → đổi base PR P01 sang `main` và merge → đổi base PR #3 (P02) sang `main` và merge. Mỗi lần merge chờ CI xanh. Dùng "Create a merge commit", không squash, để giữ lịch sử từng phase.

### 3.5 Cấu hình (mục 7 và 12)

`packages/db/src/client.ts`:

```ts
pool ??= new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX ?? 5),
})
```

`apps/web/src/server/http.ts`: thêm ở đầu file `const MAX_BODY_BYTES = Number(process.env.MAX_BODY_BYTES ?? 16384)` và thay hai chỗ `16384` bằng `MAX_BODY_BYTES`.

`scripts/dev.mjs` (tùy chọn, **cần chủ dự án quyết**): thay `'0.0.0.0'` bằng `process.env.DEV_HOST ?? '127.0.0.1'`, thêm `DEV_HOST=127.0.0.1` vào `.env.example` kèm chú thích. Với Codex Cloud (cần cổng mở ra ngoài) đặt `DEV_HOST=0.0.0.0` trong môi trường Cloud và ghi vào `docs/runbooks/local-practice.md`. Đánh đổi: an toàn hơn trên máy cá nhân, nhưng phải cấu hình thêm khi chạy Cloud.

### 3.6 Tài liệu

**`README.md`**: thay các đoạn lỗi thời.

- Dòng 3: thay bằng
  `Web ôn thi cho 5 môn Dược. Trạng thái hiện tại: **P02 hoàn tất** — luyện trắc nghiệm A/B/C/D trên **1 môn tổng hợp (10 câu mẫu)**, người dùng dev cố định, chưa có nội dung môn học thật, AI hoặc đăng nhập. Plan gốc: `IMPLEMENTATION_PLAN.md`; tiến độ thực tế: `docs/status.md`.`
- Đoạn "Mở http://localhost:3000...": thêm câu `Chạy thêm pnpm db:migrate và pnpm db:seed trước pnpm dev để có dữ liệu mẫu (xem docs/runbooks/local-practice.md).` và bỏ câu "P00 chỉ có trang tên dự án".
- Đoạn "App P00 chưa truy cập database": thay bằng `Từ P02 app đọc DATABASE_URL (đặt trong .env ở gốc repo; scripts/dev.mjs nạp file này). Không đưa secret vào biến NEXT_PUBLIC_*.`
- Bảng lệnh: thêm `pnpm db:migrate`, `pnpm db:seed`, `pnpm test:integration`, `pnpm e2e`; xóa chúng khỏi danh sách "to be established" (giữ `content:*`).
- Mục Cấu trúc: thêm `packages/db/`, `packages/api-contract/`, `content/fixtures/`, `tests/`, `spikes/`; sửa dòng `.github/workflows/` thành `CI: P00 (ci.yml), P01 (phase-01.yml), P02 (phase-02.yml)`.

**Một nguồn sự thật cho trạng thái** (thêm vào `AGENTS.md`, mục quy tắc tài liệu):

```md
- `docs/status.md` là nguồn duy nhất cho trạng thái phase/task và bằng chứng kiểm chứng.
- `handoff.md` tối đa 40 dòng: việc đang dở, lệnh chạy, bước kế tiếp. Không lặp lại bảng trạng thái.
- `worked.md` chỉ ghi nối thêm (append-only) phần phát sinh ngoài plan.
- Khi cập nhật trạng thái: sửa `docs/status.md` trước, rồi chỉ trỏ link từ các file khác.
```

## 4. Phạm vi ảnh hưởng và hoàn tác

- FR/ADR/task: FR-004, FR-005 (nền cho P04-T03), P02-T01..T04, AC-2 (độ đúng đáp án). Không ADR nào bị thay thế; ghi **ADR-0012** "Ràng buộc MCQ và niêm phong revision ở tầng DB" (bổ sung ADR-0005, không sửa).
- File: `packages/db/migrations/0002_*.sql` (mới), `packages/db/src/seed.ts`, `packages/db/src/practice.ts`, `packages/db/src/client.ts`, `apps/web/src/server/http.ts`, `tests/integration/*`, `.github/workflows/phase-02.yml`, `README.md`, `AGENTS.md`, `.env.example` (nếu chọn `DEV_HOST`), `scripts/dev.mjs` (tùy chọn).
- Chi phí: không phát sinh. Rủi ro chính: trigger làm các luồng ghi sau này (P04 importer, P06 pipeline) phải ghi đúng thứ tự trong một transaction; đây là chủ đích.
- Dữ liệu: migration có bước kiểm dữ liệu cũ; dữ liệu seed hiện tại thỏa. DB local đã seed chạy được `db:migrate` mà không cần xóa volume.
- **Rollback thủ công** (chạy bằng `psql` trong transaction, rồi xóa dòng `0002_...` khỏi `_migrations`):

```sql
BEGIN;
DROP TRIGGER IF EXISTS question_choices_guard ON question_choices;
DROP TRIGGER IF EXISTS question_revisions_guard ON question_revisions;
DROP TRIGGER IF EXISTS question_choices_valid ON question_choices;
DROP TRIGGER IF EXISTS question_revisions_valid ON question_revisions;
DROP FUNCTION IF EXISTS guard_sealed_choice(), guard_sealed_revision(), revision_is_sealed(uuid),
  check_choice_change(), check_revision_insert(), assert_mcq_revision(uuid);
ALTER TABLE question_topics DROP CONSTRAINT IF EXISTS question_topics_topic_subject,
  DROP CONSTRAINT IF EXISTS question_topics_question_subject, DROP COLUMN IF EXISTS subject_id;
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_id_subject_key;
DELETE FROM _migrations WHERE name = '0002_integrity_hardening.sql';
COMMIT;
```

Với bản code: `git revert` commit tương ứng (seed.ts phải quay lại cùng lúc với rollback SQL).

## 5. Việc không làm trong CR này (kèm tiền điều kiện)

| Vấn đề                      | Xử lý                                                                                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #3 Luồng duyệt              | Làm ở P04-T03. **Tiền điều kiện thêm vào plan:** chuyển `draft → verified → approved` chỉ qua một hàm/dịch vụ duy nhất, kiểm nguồn (đã có trong tiêu chí P04), ghi nhật ký người duyệt; seed không được tự đặt `approved` ngoài dữ liệu tổng hợp.                      |
| #6 `ORDER BY random()`      | Xem lại khi một môn có hơn khoảng 2.000 câu `approved` hoặc khi tạo đề > 100 ms ở p95. Phương án: chọn theo khoảng id ngẫu nhiên hoặc lấy mẫu rồi xáo trộn.                                                                                                              |
| #7 Origin, đăng nhập        | **Tiền điều kiện P03:** `APP_ORIGIN` bắt buộc ở production (thiếu thì từ chối khởi động); thay danh tính dev bằng phiên thật; bỏ việc suy ra Origin từ `Host`; thêm giới hạn tần suất.                                                                                   |
| #10 Mật khẩu dev            | **Task P12:** khi `NODE_ENV=production`, từ chối khởi động nếu `DATABASE_URL` chứa `local-dev-only` hoặc `127.0.0.1`.                                                                                                                                                    |
| #11 `minimatch`             | Chạy `pnpm audit` mỗi phase; cập nhật khi bản vá có trong toolchain, không nâng ngoài phạm vi.                                                                                                                                                                         |
| Quy tắc `by_topic` nhiều chủ đề | Cần quyết định: (a) tính vào mọi chủ đề (hiện tại), hay (b) chỉ chủ đề chính. Quyết định trước P05 (thống kê chủ đề yếu).                                                                                                                                           |

## 6. Quyết định của chủ dự án

Chờ điền: Duyệt / Từ chối / Sửa theo ghi chú. Các điểm cần trả lời cụ thể:

1. Chấp nhận quy tắc niêm phong ở mục 2.2?
2. `DEV_HOST` mặc định `127.0.0.1`: có / không?
3. Quy tắc `by_topic` nhiều chủ đề: (a) hay (b)?
4. Cho phép gộp PR #1, P01, #3 vào `main` theo mục 3.4?

## 7. Kiểm chứng sau khi duyệt (Codex chạy và báo kết quả thật)

```bash
pnpm install --frozen-lockfile
docker compose -f infra/docker-compose.yml up -d --wait
pnpm db:migrate && pnpm db:seed && pnpm db:migrate && pnpm db:seed   # chạy lặp phải đạt
pnpm lint && pnpm format:check
pnpm typecheck
pnpm test && pnpm test:integration
pnpm e2e
pnpm build
```

Tiêu chí chấp nhận:

1. `db:migrate` trên DB rỗng và trên DB đã seed (từ P02) đều đạt; chạy lại không lỗi.
2. Toàn bộ test cũ (3 unit, 7 integration, 2 E2E) vẫn xanh sau khi sửa test ở 3.3(a).
3. 7 test mới trong `db-integrity.test.ts` xanh. Kiểm ngược: nếu chưa áp `0002` thì các test 1, 2, 3, 5, 6 và 7 phải đỏ; test 4 vẫn xanh vì ràng buộc đó đã có từ `0001`. Mục đích là chứng minh test thật sự bắt được lỗi.
4. `readAttempt` chỉ còn 1 truy vấn lấy danh sách câu và lựa chọn (kiểm bằng log truy vấn PostgreSQL hoặc đếm lời gọi `query`).
5. CI chạy khi mở PR từ `phase-*` vào `phase-*`.

Thứ tự cập nhật theo quy định (mục 15 của plan): decision register → mục liên quan trong `IMPLEMENTATION_PLAN.md` (tăng phiên bản) → `docs/status.md` → mã.

## 8. Gợi ý commit

1. `docs: CR-0001 và ADR-0012` (sau khi duyệt)
2. `db: migration 0002 và cập nhật seed`
3. `test: ràng buộc DB và sửa test revision`
4. `db: gộp truy vấn readAttempt`
5. `ci: mở rộng trigger phase-02`
6. `chore: cấu hình pool/payload, DEV_HOST`
7. `docs: README và quy tắc nguồn sự thật`

## 9. Prompt giao cho Codex (sau khi chủ dự án duyệt)

```text
Đọc AGENTS.md, docs/decision-register.md, docs/status.md, handoff.md và docs/change-requests/CR-0001-p02-review-hardening.md (đã Accepted).
Chỉ thực hiện CR-0001 trên nhánh phase-02-hardening. Không bắt đầu P03, không merge, không deploy.
Làm theo thứ tự commit ở mục 8. Với mỗi commit chỉ chạy kiểm tra liên quan; sau commit 4 chạy đủ chuỗi ở mục 7.
Nếu SQL hoặc test trong CR không chạy được, dừng, ghi docs/blockers.md với lỗi thật, không tự thay đổi thiết kế.
Cuối cùng cập nhật docs/status.md và handoff.md (tối đa 40 dòng) bằng kết quả đo thật.
```
