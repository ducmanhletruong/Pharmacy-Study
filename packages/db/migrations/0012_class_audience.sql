-- Invitations start unbound, and only a verified Google identity can claim one.
CREATE TABLE class_invitations (
 email citext PRIMARY KEY,
 user_id uuid UNIQUE REFERENCES users(id) ON DELETE SET NULL,
 invited_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
ALTER TABLE class_invitations OWNER TO migrator;
REVOKE ALL ON class_invitations FROM PUBLIC,app_rw;

CREATE FUNCTION bind_class_invitation(member uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 UPDATE public.class_invitations i SET user_id=u.id
 FROM public.users u
 WHERE u.id=member AND u.status='active' AND i.email=u.email
 AND i.user_id IS NULL AND i.revoked_at IS NULL
 AND EXISTS(SELECT 1 FROM public.auth_identities g WHERE g.user_id=u.id AND g.provider='google');
$$;
ALTER FUNCTION bind_class_invitation(uuid) OWNER TO migrator;
REVOKE ALL ON FUNCTION bind_class_invitation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION bind_class_invitation(uuid) TO app_rw;

-- A fresh viewer tier is resolved inside each statement that reads content.
CREATE FUNCTION viewer_audience(member uuid, allow_admin boolean) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT COALESCE((
  SELECT CASE
   WHEN allow_admin AND u.role='admin' THEN 3
   WHEN EXISTS(
    SELECT 1 FROM public.class_invitations i
    JOIN public.auth_identities g ON g.user_id=i.user_id AND g.provider='google'
    WHERE i.user_id=u.id AND i.email=u.email AND i.revoked_at IS NULL
   ) THEN 2
   ELSE 1 END
  FROM public.users u WHERE u.id=member AND u.status='active'
 ), 0);
$$;
ALTER FUNCTION viewer_audience(uuid,boolean) OWNER TO migrator;
REVOKE ALL ON FUNCTION viewer_audience(uuid,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION viewer_audience(uuid,boolean) TO app_rw;

CREATE FUNCTION can_view_revision(rev uuid, subject uuid, viewer integer) RETURNS boolean
LANGUAGE sql STABLE SET search_path=pg_catalog,public AS $$
 SELECT CASE
  WHEN viewer=3 THEN true
  WHEN viewer IS NULL OR viewer NOT IN (1,2) THEN false
  WHEN NOT public.content_release_ready(rev,subject) THEN false
  ELSE viewer >= (
   SELECT max(CASE s.audience WHEN 'public' THEN 1 WHEN 'class' THEN 2 ELSE 3 END)
   FROM public.sources s
   JOIN (
    SELECT qs.source_id FROM public.question_sources qs WHERE qs.revision_id=rev
    UNION ALL
    SELECT a.source_id FROM public.question_assets qa JOIN public.assets a ON a.id=qa.asset_id
    WHERE qa.revision_id=rev AND a.source_id IS NOT NULL
   ) links ON links.source_id=s.id
  ) END;
$$;
ALTER FUNCTION can_view_revision(uuid,uuid,integer) OWNER TO migrator;
REVOKE ALL ON FUNCTION can_view_revision(uuid,uuid,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION can_view_revision(uuid,uuid,integer) TO app_rw;
