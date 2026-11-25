-- Resolve citext for class invitations on hosts that install extensions out of public.
DO $$
DECLARE
  extension_schema name;
  extension_namespace oid;
BEGIN
  SELECT n.nspname, n.oid INTO STRICT extension_schema, extension_namespace
  FROM pg_catalog.pg_extension e
  JOIN pg_catalog.pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'citext';

  IF extension_schema = 'public' THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles r
    WHERE r.rolname IN ('app_rw', 'anon', 'authenticated')
      AND pg_catalog.has_schema_privilege(r.oid, extension_namespace, 'CREATE')
  ) THEN
    RAISE EXCEPTION 'citext schema is writable by an application role';
  END IF;

  EXECUTE pg_catalog.format(
    'ALTER FUNCTION public.set_class_invitation(uuid,text,boolean) SET search_path TO pg_catalog,public,%I',
    extension_schema
  );
  EXECUTE pg_catalog.format(
    'ALTER FUNCTION public.bind_class_invitation(uuid) SET search_path TO pg_catalog,public,%I',
    extension_schema
  );
  EXECUTE pg_catalog.format(
    'ALTER FUNCTION public.viewer_audience(uuid,boolean) SET search_path TO pg_catalog,public,%I',
    extension_schema
  );
END;
$$;
