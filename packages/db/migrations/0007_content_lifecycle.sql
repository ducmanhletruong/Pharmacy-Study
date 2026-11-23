-- P04: private content provenance, transactional imports and review/report workflow.
CREATE TABLE sources (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject_id uuid NOT NULL REFERENCES subjects(id),
 kind text NOT NULL CHECK(kind IN ('notebooklm','web','upload','manual')),
 title text NOT NULL, locator text NOT NULL, license text NOT NULL,
 review_status text NOT NULL DEFAULT 'pending' CHECK(review_status IN ('pending','approved','rejected')),
 retrieved_at timestamptz NOT NULL, fingerprint text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(subject_id,fingerprint), UNIQUE(id,subject_id)
);
CREATE INDEX sources_review ON sources(review_status,subject_id);
CREATE TABLE assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text NOT NULL CHECK(kind IN ('svg','png','jpeg','webp')),
 storage_key text NOT NULL UNIQUE, mime text NOT NULL, width int NOT NULL CHECK(width>0), height int NOT NULL CHECK(height>0),
 source_id uuid REFERENCES sources(id), license text NOT NULL, attribution text NOT NULL, alt_text text NOT NULL,
 sha256 text NOT NULL UNIQUE, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE question_sources (
 revision_id uuid NOT NULL REFERENCES question_revisions(id), source_id uuid NOT NULL REFERENCES sources(id),
 locator text NOT NULL, PRIMARY KEY(revision_id,source_id,locator)
);
CREATE TABLE question_assets (
 revision_id uuid NOT NULL REFERENCES question_revisions(id), asset_id uuid NOT NULL REFERENCES assets(id),
 PRIMARY KEY(revision_id,asset_id)
);
CREATE TABLE accepted_answers (
 revision_id uuid NOT NULL REFERENCES question_revisions(id), answer_normalized text NOT NULL,
 display text NOT NULL, is_primary boolean NOT NULL DEFAULT false, PRIMARY KEY(revision_id,answer_normalized)
);
CREATE TABLE imports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), uploaded_by uuid NOT NULL REFERENCES users(id),
 bundle_hash text NOT NULL UNIQUE, status text NOT NULL CHECK(status='imported'),
 counts jsonb NOT NULL, report jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE questions ADD COLUMN import_id uuid REFERENCES imports(id);
CREATE TABLE import_questions (
 import_id uuid NOT NULL REFERENCES imports(id), external_id text NOT NULL, question_id uuid NOT NULL REFERENCES questions(id),
 PRIMARY KEY(import_id,external_id)
);
CREATE TABLE question_content_hashes (
 subject_id uuid NOT NULL, content_hash text NOT NULL, question_id uuid NOT NULL, revision_id uuid NOT NULL,
 PRIMARY KEY(subject_id,content_hash),
 FOREIGN KEY(question_id,subject_id) REFERENCES questions(id,subject_id),
 FOREIGN KEY(revision_id,question_id) REFERENCES question_revisions(id,question_id)
);
CREATE TABLE question_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question_id uuid NOT NULL REFERENCES questions(id),
 revision_id uuid NOT NULL, reporter_id uuid NOT NULL REFERENCES users(id),
 reason text NOT NULL CHECK(reason IN ('wrong_answer','ambiguous','typo','bad_image','other')), note text NOT NULL DEFAULT '',
 status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','accepted','rejected','resolved')),
 resolved_by uuid REFERENCES users(id), resolution_note text, created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz,
 FOREIGN KEY(revision_id,question_id) REFERENCES question_revisions(id,question_id)
);
CREATE UNIQUE INDEX reporter_open_question ON question_reports(reporter_id,question_id) WHERE status='open';
CREATE INDEX question_reports_queue ON question_reports(status,created_at);

DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['sources','assets','question_sources','question_assets','accepted_answers','imports','import_questions','question_content_hashes','question_reports'] LOOP
  EXECUTE format('ALTER TABLE %I OWNER TO migrator',tbl);
 END LOOP;
END $$;
GRANT SELECT,INSERT ON sources,assets,imports,import_questions,question_content_hashes TO app_rw;
GRANT UPDATE(review_status) ON sources TO app_rw;
GRANT UPDATE(counts,report) ON imports TO app_rw;
GRANT SELECT,INSERT,UPDATE ON question_reports TO app_rw;
GRANT INSERT ON subjects,topics,questions,question_revisions,question_choices,question_topics,question_sources,question_assets,accepted_answers TO app_rw;
GRANT SELECT ON question_sources,question_assets,accepted_answers TO app_rw;
GRANT UPDATE(status,current_revision_id,version,difficulty,updated_at,import_id) ON questions TO app_rw;
GRANT DELETE ON question_topics TO app_rw;

CREATE FUNCTION content_release_ready(rev uuid,subject uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT EXISTS(SELECT 1 FROM public.question_sources WHERE revision_id=rev)
 AND NOT EXISTS(SELECT 1 FROM public.question_sources qs JOIN public.sources s ON s.id=qs.source_id
  WHERE qs.revision_id=rev AND (s.subject_id<>subject OR s.review_status<>'approved' OR btrim(s.license)=''))
 AND NOT EXISTS(SELECT 1 FROM public.question_assets qa JOIN public.assets a ON a.id=qa.asset_id LEFT JOIN public.sources s ON s.id=a.source_id
  WHERE qa.revision_id=rev AND (btrim(a.license)='' OR (a.source_id IS NOT NULL AND (s.review_status<>'approved' OR s.subject_id<>subject OR btrim(s.license)=''))));
$$;
ALTER FUNCTION content_release_ready(uuid,uuid) OWNER TO migrator;
REVOKE ALL ON FUNCTION content_release_ready(uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION content_release_ready(uuid,uuid) TO app_rw,migrator;
CREATE FUNCTION guard_content_release() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 -- Only the existing synthetic seed, operated through maintenance, may bypass provenance.
 IF NOT pg_has_role(session_user,'app_rw','MEMBER') AND (pg_has_role(session_user,'migrator','MEMBER') OR EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname=session_user AND rolsuper)) AND EXISTS(SELECT 1 FROM public.subjects WHERE id=NEW.subject_id AND code='synthetic') THEN RETURN NEW; END IF;
 IF NEW.status IN ('verified','approved') THEN
  UPDATE public.topic_write_locks SET version=version+1 WHERE subject_id=NEW.subject_id;
  IF (TG_OP='INSERT' AND NEW.status='approved') OR (TG_OP='UPDATE' AND OLD.status='draft' AND NEW.status='approved') THEN
   RAISE EXCEPTION 'draft must pass verification before approval' USING ERRCODE='check_violation';
  END IF;
  IF NEW.current_revision_id IS NULL OR NOT public.content_release_ready(NEW.current_revision_id,NEW.subject_id) THEN
   RAISE EXCEPTION 'reviewed licensed provenance is required before release' USING ERRCODE='check_violation';
  END IF;
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION guard_content_release() OWNER TO migrator;
REVOKE ALL ON FUNCTION guard_content_release() FROM PUBLIC,app_rw;
CREATE TRIGGER questions_content_gate BEFORE INSERT OR UPDATE OF status,current_revision_id ON questions
 FOR EACH ROW EXECUTE FUNCTION guard_content_release();

CREATE FUNCTION guard_content_links() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE rev uuid; subject uuid;
BEGIN
 IF TG_OP='INSERT' THEN rev=NEW.revision_id; ELSE rev=OLD.revision_id; END IF;
 IF TG_OP='UPDATE' AND NEW.revision_id<>OLD.revision_id THEN RAISE EXCEPTION 'provenance identity is immutable' USING ERRCODE='restrict_violation'; END IF;
 SELECT q.subject_id INTO subject FROM public.question_revisions r JOIN public.questions q ON q.id=r.question_id WHERE r.id=rev;
 UPDATE public.topic_write_locks SET version=version+1 WHERE subject_id=subject;
 IF EXISTS(SELECT 1 FROM public.revision_seals WHERE revision_id=rev) THEN
  RAISE EXCEPTION 'sealed provenance is immutable; create a new revision' USING ERRCODE='restrict_violation';
 END IF;
 IF TG_TABLE_NAME='question_sources' AND TG_OP<>'DELETE' THEN
  IF NOT EXISTS(SELECT 1 FROM public.sources WHERE id=NEW.source_id AND subject_id=subject) THEN
   RAISE EXCEPTION 'source belongs to another subject' USING ERRCODE='foreign_key_violation';
  END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION guard_content_links() OWNER TO migrator;
REVOKE ALL ON FUNCTION guard_content_links() FROM PUBLIC,app_rw;
CREATE TRIGGER question_sources_history BEFORE INSERT OR UPDATE OR DELETE ON question_sources FOR EACH ROW EXECUTE FUNCTION guard_content_links();
CREATE TRIGGER question_assets_history BEFORE INSERT OR UPDATE OR DELETE ON question_assets FOR EACH ROW EXECUTE FUNCTION guard_content_links();
CREATE TRIGGER accepted_answers_history BEFORE INSERT OR UPDATE OR DELETE ON accepted_answers FOR EACH ROW EXECUTE FUNCTION guard_content_links();

CREATE FUNCTION reject_source_content() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 UPDATE public.topic_write_locks SET version=version+1 WHERE subject_id=NEW.subject_id;
 IF NEW.review_status<>'approved' THEN
  UPDATE public.questions q SET status='under_review',version=version+1,updated_at=now()
  WHERE q.subject_id=NEW.subject_id AND q.status IN ('verified','approved')
   AND (EXISTS(SELECT 1 FROM public.question_sources qs WHERE qs.revision_id=q.current_revision_id AND qs.source_id=NEW.id)
    OR EXISTS(SELECT 1 FROM public.question_assets qa JOIN public.assets a ON a.id=qa.asset_id WHERE qa.revision_id=q.current_revision_id AND a.source_id=NEW.id));
 END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION reject_source_content() OWNER TO migrator;
REVOKE ALL ON FUNCTION reject_source_content() FROM PUBLIC,app_rw;
CREATE TRIGGER source_review_quarantine BEFORE UPDATE OF review_status ON sources FOR EACH ROW EXECUTE FUNCTION reject_source_content();
