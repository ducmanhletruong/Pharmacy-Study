-- A BEFORE INSERT trigger cannot yet find NEW.id in the topics relation.
-- For multi-row inserts, an existing ancestor can already point at that new
-- row, closing a cycle. Check the ancestor edge as well as the visible IDs.
-- Recheck existing data: never silently repair a graph accepted before this fix.
DO $$ BEGIN
 IF EXISTS(WITH RECURSIVE walk AS (
  SELECT id,parent_id,ARRAY[id] path,false cycle FROM public.topics
  UNION ALL SELECT t.id,t.parent_id,w.path||t.id,t.id=ANY(w.path)
   FROM walk w JOIN public.topics t ON t.id=w.parent_id WHERE NOT w.cycle
 ) SELECT 1 FROM walk WHERE cycle) THEN
  RAISE EXCEPTION 'existing topic graph contains a cycle' USING ERRCODE='check_violation';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION guard_topic_graph() RETURNS trigger
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
  ) SELECT 1 FROM ancestors WHERE id=NEW.id OR parent_id=NEW.id
 ) THEN RAISE EXCEPTION 'topic graph cannot contain a cycle' USING ERRCODE='check_violation'; END IF;
 RETURN NEW;
END $$;
ALTER FUNCTION guard_topic_graph() OWNER TO migrator;
REVOKE ALL ON FUNCTION guard_topic_graph() FROM PUBLIC,app_rw;
