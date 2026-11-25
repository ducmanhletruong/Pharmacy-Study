ALTER TABLE questions DROP CONSTRAINT questions_type_check;
ALTER TABLE questions ADD CONSTRAINT questions_type_check
 CHECK(type IN ('mcq','name_from_structure','image_hotspot'));

CREATE FUNCTION assert_revision_choices(rev uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  kind text;
  n_total int;
  n_correct int;
  n_distinct int;
BEGIN
  SELECT q.type INTO kind FROM question_revisions r JOIN questions q ON q.id=r.question_id WHERE r.id=rev;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT count(*),count(*) FILTER(WHERE is_correct),count(DISTINCT lower(btrim(text)))
  INTO n_total,n_correct,n_distinct FROM question_choices WHERE revision_id=rev;
  IF (kind='mcq' AND (n_total<>4 OR n_correct<>1 OR n_distinct<>4))
     OR (kind<>'mcq' AND n_total<>0) THEN
    RAISE EXCEPTION 'Question revision has an invalid choice inventory' USING ERRCODE='check_violation';
  END IF;
END;
$$;
ALTER FUNCTION assert_revision_choices(uuid) OWNER TO migrator;

CREATE FUNCTION check_revision_choices() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='question_revisions' THEN
  PERFORM assert_revision_choices(NEW.id);
 ELSE
  IF TG_OP<>'INSERT' THEN PERFORM assert_revision_choices(OLD.revision_id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM assert_revision_choices(NEW.revision_id); END IF;
 END IF;
 RETURN NULL;
END;
$$;
ALTER FUNCTION check_revision_choices() OWNER TO migrator;
DROP TRIGGER question_choices_valid ON question_choices;
DROP TRIGGER question_revisions_valid ON question_revisions;
CREATE CONSTRAINT TRIGGER question_choices_valid AFTER INSERT OR UPDATE OR DELETE ON question_choices
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_revision_choices();
CREATE CONSTRAINT TRIGGER question_revisions_valid AFTER INSERT ON question_revisions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_revision_choices();

CREATE FUNCTION assert_visual_revision(rev uuid) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
 question_kind text;
 visual jsonb;
BEGIN
 SELECT q.type,r.payload->'visual' INTO question_kind,visual
 FROM question_revisions r JOIN questions q ON q.id=r.question_id WHERE r.id=rev;
 IF NOT FOUND OR question_kind='mcq' THEN RETURN; END IF;
 IF visual->>'type' IS DISTINCT FROM question_kind
 OR (SELECT count(*) FROM question_assets WHERE revision_id=rev)<>1
 OR NOT EXISTS(
  SELECT 1 FROM question_assets qa JOIN assets a ON a.id=qa.asset_id
  JOIN question_sources qs ON qs.source_id=a.source_id AND qs.revision_id=qa.revision_id
  WHERE qa.revision_id=rev AND btrim(a.license)<>'' AND (question_kind<>'name_from_structure' OR a.kind='svg')
 )
 OR (question_kind='name_from_structure' AND (btrim(COALESCE(visual->>'smiles',''))='' OR
     (SELECT count(*) FROM accepted_answers WHERE revision_id=rev AND is_primary)<>1))
 OR (question_kind='image_hotspot' AND (jsonb_typeof(visual->'hotspot') IS DISTINCT FROM 'object'
     OR EXISTS(SELECT 1 FROM accepted_answers WHERE revision_id=rev))) THEN
  RAISE EXCEPTION 'Visual question revision lacks an asset or answer key' USING ERRCODE='check_violation';
 END IF;
END;
$$;
ALTER FUNCTION assert_visual_revision(uuid) OWNER TO migrator;

CREATE FUNCTION check_visual_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='question_revisions' THEN
  PERFORM assert_visual_revision(NEW.id);
 ELSE
  IF TG_OP<>'INSERT' THEN PERFORM assert_visual_revision(OLD.revision_id); END IF;
  IF TG_OP<>'DELETE' THEN PERFORM assert_visual_revision(NEW.revision_id); END IF;
 END IF;
 RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER visual_revision_complete AFTER INSERT OR UPDATE ON question_revisions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_visual_revision();
CREATE CONSTRAINT TRIGGER visual_asset_complete AFTER INSERT OR UPDATE OR DELETE ON question_assets
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_visual_revision();
CREATE CONSTRAINT TRIGGER visual_answer_complete AFTER INSERT OR UPDATE OR DELETE ON accepted_answers
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_visual_revision();
CREATE CONSTRAINT TRIGGER visual_source_complete AFTER INSERT OR UPDATE OR DELETE ON question_sources
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION check_visual_revision();
