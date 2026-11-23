-- RV-09/10/12: permanent known seals, serialized taxonomy writers and attempt topics.
-- Legacy history that was already rewound before this migration cannot be inferred.
CREATE TABLE revision_seals (
 revision_id uuid PRIMARY KEY REFERENCES question_revisions(id),
 sealed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE revision_write_locks (
 question_id uuid PRIMARY KEY REFERENCES questions(id) ON DELETE CASCADE,
 version bigint NOT NULL DEFAULT 0
);
CREATE TABLE topic_write_locks (
 subject_id uuid PRIMARY KEY REFERENCES subjects(id) ON DELETE CASCADE,
 version bigint NOT NULL DEFAULT 0
);
ALTER TABLE revision_seals OWNER TO migrator;
ALTER TABLE revision_write_locks OWNER TO migrator;
ALTER TABLE topic_write_locks OWNER TO migrator;
REVOKE ALL ON revision_seals,revision_write_locks,topic_write_locks FROM PUBLIC,app_rw;
INSERT INTO revision_write_locks(question_id) SELECT id FROM questions;
INSERT INTO topic_write_locks(subject_id) SELECT id FROM subjects;
INSERT INTO revision_seals(revision_id)
 SELECT r.id FROM question_revisions r JOIN questions q ON q.id=r.question_id
 WHERE q.status<>'draft' OR (q.current_revision_id IS NOT NULL AND q.current_revision_id<>r.id)
 OR EXISTS(SELECT 1 FROM attempt_items i WHERE i.question_revision_id=r.id);

CREATE FUNCTION keep_revision_seals() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 RAISE EXCEPTION 'revision seals are permanent' USING ERRCODE='restrict_violation';
END $$;
CREATE TRIGGER revision_seals_immutable BEFORE UPDATE OR DELETE ON revision_seals
 FOR EACH ROW EXECUTE FUNCTION keep_revision_seals();

-- A real row write, not an advisory/read lock: RR writers with an old snapshot
-- receive serialization_failure instead of validating a graph/seal from that snapshot.
CREATE FUNCTION serialize_revision_writes(ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE question uuid;
BEGIN
 FOR question IN SELECT DISTINCT x FROM unnest(ids) x WHERE x IS NOT NULL ORDER BY x LOOP
  UPDATE public.revision_write_locks SET version=version+1 WHERE question_id=question;
  IF NOT FOUND THEN RAISE EXCEPTION 'revision lock is unavailable' USING ERRCODE='foreign_key_violation'; END IF;
 END LOOP;
END $$;
ALTER FUNCTION serialize_revision_writes(uuid[]) OWNER TO migrator;
REVOKE ALL ON FUNCTION serialize_revision_writes(uuid[]) FROM PUBLIC,app_rw;

CREATE OR REPLACE FUNCTION revision_is_sealed(rev uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.revision_seals WHERE revision_id=rev)
 OR EXISTS(SELECT 1 FROM public.attempt_items WHERE question_revision_id=rev)
 OR EXISTS(SELECT 1 FROM public.question_revisions r JOIN public.questions q ON q.id=r.question_id
   WHERE r.id=rev AND (q.status<>'draft' OR (q.current_revision_id IS NOT NULL AND q.current_revision_id<>r.id)));
$$;
ALTER FUNCTION revision_is_sealed(uuid) OWNER TO migrator;
REVOKE ALL ON FUNCTION revision_is_sealed(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION revision_is_sealed(uuid) TO app_rw,migrator;

CREATE FUNCTION initialize_history_locks() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF TG_TABLE_NAME='questions' THEN INSERT INTO public.revision_write_locks(question_id) VALUES(NEW.id);
 ELSE INSERT INTO public.topic_write_locks(subject_id) VALUES(NEW.id); END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION initialize_history_locks() OWNER TO migrator;
REVOKE ALL ON FUNCTION initialize_history_locks() FROM PUBLIC,app_rw;
CREATE TRIGGER questions_history_lock AFTER INSERT ON questions FOR EACH ROW EXECUTE FUNCTION initialize_history_locks();
CREATE TRIGGER subjects_history_lock AFTER INSERT ON subjects FOR EACH ROW EXECUTE FUNCTION initialize_history_locks();

CREATE FUNCTION record_question_seals() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.serialize_revision_writes(ARRAY[OLD.id]);
 INSERT INTO public.revision_seals(revision_id)
  SELECT r.id FROM public.question_revisions r WHERE r.question_id=OLD.id
   AND (NEW.status<>'draft' OR (NEW.current_revision_id IS NOT NULL AND NEW.current_revision_id<>r.id))
  ON CONFLICT DO NOTHING;
 RETURN NEW;
END $$;
ALTER FUNCTION record_question_seals() OWNER TO migrator;
REVOKE ALL ON FUNCTION record_question_seals() FROM PUBLIC,app_rw;
CREATE TRIGGER questions_record_seals BEFORE UPDATE OF status,current_revision_id ON questions
 FOR EACH ROW EXECUTE FUNCTION record_question_seals();

CREATE FUNCTION serialize_new_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.serialize_revision_writes(ARRAY[NEW.question_id]);
 RETURN NEW;
END $$;
ALTER FUNCTION serialize_new_revision() OWNER TO migrator;
REVOKE ALL ON FUNCTION serialize_new_revision() FROM PUBLIC,app_rw;
CREATE TRIGGER revision_insert_lock BEFORE INSERT ON question_revisions
 FOR EACH ROW EXECUTE FUNCTION serialize_new_revision();

-- Evaluate new candidates at the transaction's final state. A newly-created draft
-- revision can become current before commit without being mistaken for an old one.
CREATE FUNCTION record_inserted_revision_seal() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF public.revision_is_sealed(NEW.id) THEN
  INSERT INTO public.revision_seals(revision_id)
   SELECT id FROM public.question_revisions WHERE id=NEW.id ON CONFLICT DO NOTHING;
 END IF;
 RETURN NULL;
END $$;
ALTER FUNCTION record_inserted_revision_seal() OWNER TO migrator;
REVOKE ALL ON FUNCTION record_inserted_revision_seal() FROM PUBLIC,app_rw;
CREATE CONSTRAINT TRIGGER revision_insert_seal AFTER INSERT ON question_revisions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION record_inserted_revision_seal();

CREATE OR REPLACE FUNCTION guard_sealed_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.serialize_revision_writes(ARRAY[OLD.question_id]);
 IF public.revision_is_sealed(OLD.id) THEN
  RAISE EXCEPTION 'revision is sealed; create a new revision' USING ERRCODE='restrict_violation';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.id<>OLD.id OR NEW.question_id<>OLD.question_id THEN
  RAISE EXCEPTION 'revision identity is immutable' USING ERRCODE='restrict_violation';
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION guard_sealed_revision() OWNER TO migrator;
REVOKE ALL ON FUNCTION guard_sealed_revision() FROM PUBLIC,app_rw;

CREATE FUNCTION serialize_choice_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 PERFORM public.serialize_revision_writes(ARRAY[(SELECT question_id FROM public.question_revisions WHERE id=NEW.revision_id)]);
 RETURN NEW;
END $$;
ALTER FUNCTION serialize_choice_insert() OWNER TO migrator;
REVOKE ALL ON FUNCTION serialize_choice_insert() FROM PUBLIC,app_rw;
CREATE TRIGGER choices_insert_lock BEFORE INSERT ON question_choices
 FOR EACH ROW EXECUTE FUNCTION serialize_choice_insert();
CREATE OR REPLACE FUNCTION guard_sealed_choice() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE new_revision uuid;
BEGIN
 IF TG_OP='UPDATE' THEN new_revision=NEW.revision_id; END IF;
 PERFORM public.serialize_revision_writes(ARRAY[
  (SELECT question_id FROM public.question_revisions WHERE id=OLD.revision_id),
  (SELECT question_id FROM public.question_revisions WHERE id=new_revision)]);
 IF public.revision_is_sealed(OLD.revision_id) OR (new_revision IS NOT NULL AND public.revision_is_sealed(new_revision)) THEN
  RAISE EXCEPTION 'revision choices are sealed; create a new revision' USING ERRCODE='restrict_violation';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION guard_sealed_choice() OWNER TO migrator;
REVOKE ALL ON FUNCTION guard_sealed_choice() FROM PUBLIC,app_rw;

-- Refuse corrupt existing graphs; do not hide or repair legacy topic data.
DO $$ BEGIN
 IF EXISTS(WITH RECURSIVE walk AS (
  SELECT id,parent_id,ARRAY[id] path,false cycle FROM topics
  UNION ALL SELECT t.id,t.parent_id,w.path||t.id,t.id=ANY(w.path)
   FROM walk w JOIN topics t ON t.id=w.parent_id WHERE NOT w.cycle
 ) SELECT 1 FROM walk WHERE cycle) THEN
  RAISE EXCEPTION 'existing topic graph contains a cycle' USING ERRCODE='check_violation';
 END IF;
END $$;
CREATE FUNCTION guard_topic_graph() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE subjects uuid[]; subject uuid;
BEGIN
 IF TG_OP='INSERT' THEN subjects=ARRAY[NEW.subject_id];
 ELSIF TG_OP='DELETE' THEN subjects=ARRAY[OLD.subject_id];
 ELSE subjects=ARRAY[OLD.subject_id,NEW.subject_id]; END IF;
 FOR subject IN SELECT DISTINCT x FROM unnest(subjects) x ORDER BY x LOOP
  UPDATE public.topic_write_locks SET version=version+1 WHERE subject_id=subject;
  IF NOT FOUND THEN RAISE EXCEPTION 'topic lock is unavailable' USING ERRCODE='foreign_key_violation'; END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.parent_id IS NOT NULL AND EXISTS(
  WITH RECURSIVE ancestors AS (
   SELECT id,parent_id FROM public.topics WHERE id=NEW.parent_id
   UNION SELECT t.id,t.parent_id FROM public.topics t JOIN ancestors a ON t.id=a.parent_id
  ) SELECT 1 FROM ancestors WHERE id=NEW.id
 ) THEN RAISE EXCEPTION 'topic graph cannot contain a cycle' USING ERRCODE='check_violation'; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION guard_topic_graph() OWNER TO migrator;
REVOKE ALL ON FUNCTION guard_topic_graph() FROM PUBLIC,app_rw;
CREATE TRIGGER topics_graph_guard BEFORE INSERT OR UPDATE OR DELETE ON topics
 FOR EACH ROW EXECUTE FUNCTION guard_topic_graph();

ALTER TABLE attempt_items ADD COLUMN topic_snapshot jsonb;
ALTER TABLE attempt_items ADD COLUMN topic_snapshot_origin text;
-- This is a best-effort migration-time snapshot, not reconstructed historical data.
-- Existing submitted attempts continue returning their stored attempts.result unchanged.
UPDATE attempt_items i SET topic_snapshot=COALESCE((
 SELECT jsonb_agg(jsonb_build_object('topic_id',t.id,'title',t.title,'sort_order',t.sort_order,'code',t.code) ORDER BY t.sort_order,t.code,t.id)
 FROM question_revisions r JOIN question_topics qt ON qt.question_id=r.question_id JOIN topics t ON t.id=qt.topic_id
 WHERE r.id=i.question_revision_id
),'[]'::jsonb),topic_snapshot_origin='legacy_backfill';
ALTER TABLE attempt_items ALTER COLUMN topic_snapshot SET NOT NULL;
ALTER TABLE attempt_items ALTER COLUMN topic_snapshot_origin SET NOT NULL;
ALTER TABLE attempt_items ADD CONSTRAINT attempt_topic_snapshot_array CHECK(jsonb_typeof(topic_snapshot)='array');
ALTER TABLE attempt_items ADD CONSTRAINT attempt_topic_snapshot_origin CHECK(topic_snapshot_origin IN ('captured','legacy_backfill'));

CREATE FUNCTION capture_attempt_topics() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE question uuid;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.id<>OLD.id OR NEW.attempt_id<>OLD.attempt_id OR NEW.position<>OLD.position
   OR NEW.question_revision_id<>OLD.question_revision_id OR NEW.topic_snapshot IS DISTINCT FROM OLD.topic_snapshot
   OR NEW.topic_snapshot_origin<>OLD.topic_snapshot_origin THEN
   RAISE EXCEPTION 'attempt item history is immutable' USING ERRCODE='restrict_violation';
  END IF;
  RETURN NEW;
 END IF;
 SELECT question_id INTO question FROM public.question_revisions WHERE id=NEW.question_revision_id;
 -- Already-sealed revisions cannot change, so ordinary practice creation does
 -- not serialize every learner on the same question. Unsealed drafts must lock.
 IF NOT EXISTS(SELECT 1 FROM public.revision_seals WHERE revision_id=NEW.question_revision_id) THEN
  PERFORM public.serialize_revision_writes(ARRAY[question]);
  INSERT INTO public.revision_seals(revision_id) VALUES(NEW.question_revision_id) ON CONFLICT DO NOTHING;
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('topic_id',t.id,'title',t.title,'sort_order',t.sort_order,'code',t.code) ORDER BY t.sort_order,t.code,t.id),'[]'::jsonb)
  INTO NEW.topic_snapshot FROM public.question_topics qt JOIN public.topics t ON t.id=qt.topic_id WHERE qt.question_id=question;
 NEW.topic_snapshot_origin='captured';
 RETURN NEW;
END $$;
ALTER FUNCTION capture_attempt_topics() OWNER TO migrator;
REVOKE ALL ON FUNCTION capture_attempt_topics() FROM PUBLIC,app_rw;
CREATE TRIGGER attempt_item_history BEFORE INSERT OR UPDATE ON attempt_items
 FOR EACH ROW EXECUTE FUNCTION capture_attempt_topics();
