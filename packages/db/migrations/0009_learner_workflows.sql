CREATE TABLE exam_blueprints (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject_id uuid NOT NULL REFERENCES subjects(id),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 120),
 status text NOT NULL CHECK(status IN ('draft','active','retired')),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 spec jsonb NOT NULL CHECK(jsonb_typeof(spec)='object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blueprint_catalog ON exam_blueprints(subject_id,status,id);
ALTER TABLE exam_blueprints OWNER TO migrator;
GRANT SELECT,INSERT,UPDATE ON exam_blueprints TO app_rw;
ALTER TABLE attempts DROP CONSTRAINT attempts_mode_check;
ALTER TABLE attempts ADD CONSTRAINT attempts_mode_check CHECK(mode IN ('practice','mock','review'));
ALTER TABLE attempts ADD COLUMN blueprint_id uuid REFERENCES exam_blueprints(id);
ALTER TABLE attempts ADD COLUMN blueprint_snapshot jsonb;
ALTER TABLE attempts ADD COLUMN random_seed text;
ALTER TABLE attempts ADD CONSTRAINT mock_configuration CHECK(mode<>'mock' OR
 (deadline_at IS NOT NULL AND blueprint_id IS NOT NULL AND blueprint_snapshot IS NOT NULL AND random_seed IS NOT NULL));
CREATE INDEX review_user_history ON attempts(user_id,subject_id,status,submitted_at DESC);
ALTER TABLE exam_blueprints ADD COLUMN created_by uuid REFERENCES users(id);
ALTER TABLE exam_blueprints ADD COLUMN idempotency_key text;
ALTER TABLE exam_blueprints ADD COLUMN request_hash text;
ALTER TABLE exam_blueprints ADD CONSTRAINT blueprint_idempotency UNIQUE(created_by,idempotency_key);
