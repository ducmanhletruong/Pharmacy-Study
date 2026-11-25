ALTER TABLE sources ADD COLUMN audience_rights_basis text CHECK(length(audience_rights_basis) BETWEEN 1 AND 1000);
GRANT UPDATE(audience_rights_basis) ON sources TO app_rw;

CREATE FUNCTION list_class_invitations(actor uuid)
RETURNS TABLE(email text, joined boolean, revoked boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public AS $$
 SELECT i.email::text, i.user_id IS NOT NULL, i.revoked_at IS NOT NULL
 FROM public.class_invitations i
 WHERE EXISTS(SELECT 1 FROM public.users u WHERE u.id=actor AND u.role='admin' AND u.status='active')
 ORDER BY i.invited_at DESC,i.email;
$$;

CREATE FUNCTION set_class_invitation(actor uuid, address text, invite boolean)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.users u WHERE u.id=actor AND u.role='admin' AND u.status='active' FOR SHARE) THEN
  RAISE EXCEPTION 'class administration requires an active administrator' USING ERRCODE='42501';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('identity:' || address));
 IF invite THEN
  INSERT INTO public.class_invitations(email,user_id)
  VALUES(address,(
   SELECT u.id FROM public.users u JOIN public.auth_identities g ON g.user_id=u.id AND g.provider='google'
   WHERE u.email=address::citext AND u.status='active'
  ))
  ON CONFLICT(email) DO UPDATE SET revoked_at=NULL,user_id=EXCLUDED.user_id,invited_at=now()
  WHERE class_invitations.revoked_at IS NOT NULL;
 ELSE
  UPDATE public.class_invitations SET revoked_at=now()
  WHERE email=address::citext AND revoked_at IS NULL;
 END IF;
 RETURN FOUND;
END;
$$;

ALTER FUNCTION list_class_invitations(uuid) OWNER TO migrator;
ALTER FUNCTION set_class_invitation(uuid,text,boolean) OWNER TO migrator;
REVOKE ALL ON FUNCTION list_class_invitations(uuid),set_class_invitation(uuid,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION list_class_invitations(uuid),set_class_invitation(uuid,text,boolean) TO app_rw;
