DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='migrator') THEN CREATE ROLE migrator NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='app_rw') THEN CREATE ROLE app_rw NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS; END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname IN ('app_rw','migrator') AND (rolsuper OR rolcreatedb OR rolcreaterole OR rolreplication OR rolbypassrls OR rolcanlogin)) THEN RAISE EXCEPTION 'Unexpected privileged project role; refuse to reuse'; END IF;
 IF pg_has_role('app_rw','migrator','MEMBER') THEN RAISE EXCEPTION 'app_rw must not inherit migrator'; END IF;
END $$;

CREATE TABLE auth_identities (
 provider text NOT NULL CHECK(provider IN ('google','test')), provider_subject text NOT NULL,
 user_id uuid NOT NULL REFERENCES users(id), PRIMARY KEY(provider,provider_subject), UNIQUE(user_id,provider)
);
CREATE TABLE auth_sessions (
 id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id),
 expires_at timestamptz NOT NULL, revoked_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX user_auth_sessions ON auth_sessions(user_id,expires_at);
CREATE TABLE audit_logs (
 id bigserial PRIMARY KEY, at timestamptz NOT NULL DEFAULT now(), actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
 action text NOT NULL, entity_type text NOT NULL, entity_id text, diff jsonb NOT NULL DEFAULT '{}', request_id uuid NOT NULL,
 CHECK(jsonb_typeof(diff)='object')
);
CREATE INDEX audit_actor_time ON audit_logs(actor_user_id,at DESC);
CREATE TABLE request_limits (
 bucket text PRIMARY KEY, window_started timestamptz NOT NULL, hits int NOT NULL CHECK(hits>0)
);

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE,CREATE ON SCHEMA public TO migrator;
GRANT USAGE ON SCHEMA public TO app_rw;
DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['_migrations','users','subjects','topics','questions','question_revisions','question_choices','question_topics','attempts','attempt_items','auth_identities','auth_sessions','audit_logs','request_limits'] LOOP
  EXECUTE format('ALTER TABLE %I OWNER TO migrator',tbl);
 END LOOP;
 EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC',current_database());
 EXECUTE format('GRANT CONNECT ON DATABASE %I TO app_rw,migrator',current_database());
END $$;
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM app_rw;
GRANT SELECT ON users,subjects,topics,questions,question_revisions,question_choices,question_topics TO app_rw;
GRANT INSERT ON users TO app_rw;
GRANT UPDATE(display_name,role,last_login_at) ON users TO app_rw;
GRANT SELECT,INSERT ON auth_identities,audit_logs TO app_rw;
GRANT SELECT,INSERT,UPDATE ON attempts,attempt_items,auth_sessions,request_limits TO app_rw;
GRANT USAGE,SELECT ON SEQUENCE audit_logs_id_seq TO app_rw;
