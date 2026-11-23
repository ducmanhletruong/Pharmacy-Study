-- Written exams are private user-owned papers, separate from the approved MCQ bank.
CREATE TABLE written_papers (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 subject_code text NOT NULL, name text NOT NULL, duration_seconds integer NOT NULL CHECK(duration_seconds BETWEEN 1 AND 14400),
 sections jsonb NOT NULL CHECK(jsonb_typeof(sections)='array'),
 exam_pdf bytea NOT NULL, reference_pdf bytea,
 content_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(user_id,content_hash)
);
CREATE TABLE written_attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),paper_id uuid NOT NULL REFERENCES written_papers(id),
 paper_snapshot jsonb NOT NULL, deadline_at timestamptz NOT NULL,
 status text NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','submitted','expired')),
 grading_status text NOT NULL DEFAULT 'ungraded' CHECK(grading_status IN ('ungraded','self_assessed')),
 score numeric CHECK(score BETWEEN 0 AND 10), started_at timestamptz NOT NULL DEFAULT now(),submitted_at timestamptz,
 idempotency_key text NOT NULL, request_hash text NOT NULL, UNIQUE(user_id,idempotency_key)
);
CREATE TABLE written_answers (
 attempt_id uuid NOT NULL REFERENCES written_attempts(id), position integer NOT NULL CHECK(position BETWEEN 1 AND 20),
 text text NOT NULL DEFAULT '' CHECK(length(text)<=20000),points numeric CHECK(points BETWEEN 0 AND 10),
 PRIMARY KEY(attempt_id,position)
);
ALTER TABLE written_papers OWNER TO migrator;
ALTER TABLE written_attempts OWNER TO migrator;
ALTER TABLE written_answers OWNER TO migrator;
GRANT SELECT,INSERT ON written_papers TO app_rw;
GRANT SELECT,INSERT,UPDATE ON written_attempts,written_answers TO app_rw;
CREATE INDEX written_owner_history ON written_attempts(user_id,started_at DESC);
CREATE INDEX written_owner_papers ON written_papers(user_id,id);
