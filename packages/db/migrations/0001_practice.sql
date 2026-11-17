CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email citext NOT NULL UNIQUE,
 display_name text NOT NULL, role text NOT NULL CHECK (role IN ('learner','admin')),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 created_at timestamptz NOT NULL DEFAULT now(), last_login_at timestamptz
);
CREATE TABLE subjects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text NOT NULL UNIQUE, name text NOT NULL);
CREATE TABLE topics (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject_id uuid NOT NULL REFERENCES subjects(id),
 parent_id uuid, code text NOT NULL, title text NOT NULL, sort_order int NOT NULL DEFAULT 0, syllabus_ref text,
 UNIQUE(subject_id,code), UNIQUE(id,subject_id),
 FOREIGN KEY(parent_id,subject_id) REFERENCES topics(id,subject_id), CHECK(id IS DISTINCT FROM parent_id)
);
CREATE INDEX topics_tree ON topics(subject_id,parent_id);
CREATE TABLE questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), subject_id uuid NOT NULL REFERENCES subjects(id),
 type text NOT NULL CHECK(type='mcq'), difficulty int NOT NULL CHECK(difficulty BETWEEN 1 AND 3),
 status text NOT NULL CHECK(status IN ('draft','verified','approved','under_review','hidden','retired')),
 current_revision_id uuid, version int NOT NULL DEFAULT 1,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK(status <> 'approved' OR current_revision_id IS NOT NULL)
);
CREATE INDEX questions_available ON questions(subject_id,status,type);
CREATE INDEX questions_status ON questions(status);
CREATE TABLE question_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), question_id uuid NOT NULL REFERENCES questions(id),
 rev_no int NOT NULL CHECK(rev_no>0), stem text NOT NULL, payload jsonb NOT NULL DEFAULT '{}',
 explanation text NOT NULL, content_hash text NOT NULL, created_by uuid NOT NULL REFERENCES users(id),
 created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(question_id,rev_no), UNIQUE(content_hash,question_id), UNIQUE(id,question_id)
);
ALTER TABLE questions ADD CONSTRAINT current_revision_owner FOREIGN KEY(current_revision_id,id)
 REFERENCES question_revisions(id,question_id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX revision_stem ON question_revisions USING gin(stem gin_trgm_ops);
CREATE TABLE question_choices (
 revision_id uuid NOT NULL REFERENCES question_revisions(id), label text NOT NULL CHECK(label IN ('A','B','C','D')),
 text text NOT NULL, is_correct boolean NOT NULL, PRIMARY KEY(revision_id,label)
);
CREATE UNIQUE INDEX one_correct_choice ON question_choices(revision_id) WHERE is_correct;
CREATE TABLE question_topics (
 question_id uuid NOT NULL REFERENCES questions(id), topic_id uuid NOT NULL REFERENCES topics(id), PRIMARY KEY(question_id,topic_id)
);
CREATE INDEX topic_questions ON question_topics(topic_id);
CREATE TABLE attempts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id), subject_id uuid NOT NULL REFERENCES subjects(id),
 mode text NOT NULL CHECK(mode='practice'), status text NOT NULL DEFAULT 'in_progress' CHECK(status IN ('in_progress','submitted','expired')),
 started_at timestamptz NOT NULL DEFAULT now(), submitted_at timestamptz, deadline_at timestamptz,
 idempotency_key text NOT NULL, request_hash text NOT NULL, result jsonb, UNIQUE(user_id,idempotency_key)
);
CREATE INDEX user_attempts ON attempts(user_id,started_at DESC);
CREATE TABLE attempt_items (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), attempt_id uuid NOT NULL REFERENCES attempts(id), position int NOT NULL CHECK(position>0),
 question_revision_id uuid NOT NULL REFERENCES question_revisions(id), answer jsonb, is_correct boolean,
 answered_at timestamptz, time_spent_ms int CHECK(time_spent_ms>=0), flagged boolean NOT NULL DEFAULT false,
 UNIQUE(attempt_id,position)
);
CREATE INDEX item_revision ON attempt_items(question_revision_id);
