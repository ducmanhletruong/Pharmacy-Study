ALTER TABLE users ADD COLUMN guest_last_active_at timestamptz;
ALTER TABLE question_reports ALTER COLUMN reporter_id DROP NOT NULL;

UPDATE users u SET guest_last_active_at=GREATEST(
 u.created_at,u.last_login_at,
 (SELECT max(GREATEST(s.created_at,s.revoked_at)) FROM auth_sessions s WHERE s.user_id=u.id),
 (SELECT max(GREATEST(a.started_at,a.submitted_at)) FROM attempts a WHERE a.user_id=u.id),
 (SELECT max(i.answered_at) FROM attempt_items i JOIN attempts a ON a.id=i.attempt_id WHERE a.user_id=u.id),
 (SELECT max(p.created_at) FROM written_papers p WHERE p.user_id=u.id),
 (SELECT max(GREATEST(a.started_at,a.submitted_at)) FROM written_attempts a WHERE a.user_id=u.id)
)
WHERE EXISTS(SELECT 1 FROM auth_identities g WHERE g.user_id=u.id AND g.provider='guest');

CREATE INDEX guest_last_activity ON users(guest_last_active_at,id) WHERE guest_last_active_at IS NOT NULL;

CREATE FUNCTION touch_guest_activity(member uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 UPDATE public.users u SET guest_last_active_at=clock_timestamp()
 WHERE u.id=member AND u.role='learner' AND u.status='active'
 AND EXISTS(SELECT 1 FROM public.auth_identities g WHERE g.user_id=u.id AND g.provider='guest');
$$;
ALTER FUNCTION touch_guest_activity(uuid) OWNER TO migrator;
REVOKE ALL ON FUNCTION touch_guest_activity(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION touch_guest_activity(uuid) TO app_rw;
