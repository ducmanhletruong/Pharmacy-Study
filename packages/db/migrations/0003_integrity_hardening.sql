-- 0003: toàn vẹn MCQ, niêm phong revision, nhất quán môn học của chủ đề.
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
