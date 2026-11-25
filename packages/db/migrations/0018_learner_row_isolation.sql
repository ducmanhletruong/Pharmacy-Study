-- The server scopes operations to the authenticated account or signed session.
-- Without that transaction-local identity the runtime role sees no private rows.
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY account_auth_sessions ON auth_sessions TO app_rw
  USING (user_id = NULLIF(current_setting('pharmacy.account_id', true), '')::uuid);

ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY learner_attempts ON attempts TO app_rw
  USING (user_id = NULLIF(current_setting('pharmacy.account_id', true), '')::uuid);

ALTER TABLE attempt_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY learner_attempt_items ON attempt_items TO app_rw
  USING (EXISTS (SELECT 1 FROM attempts a WHERE a.id = attempt_items.attempt_id));

ALTER TABLE written_papers ENABLE ROW LEVEL SECURITY;
CREATE POLICY learner_written_papers ON written_papers TO app_rw
  USING (user_id = NULLIF(current_setting('pharmacy.account_id', true), '')::uuid);

ALTER TABLE written_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY learner_written_attempts ON written_attempts TO app_rw
  USING (user_id = NULLIF(current_setting('pharmacy.account_id', true), '')::uuid)
  WITH CHECK (
    user_id = NULLIF(current_setting('pharmacy.account_id', true), '')::uuid
    AND EXISTS (SELECT 1 FROM written_papers p WHERE p.id = written_attempts.paper_id)
  );

ALTER TABLE written_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY learner_written_answers ON written_answers TO app_rw
  USING (EXISTS (SELECT 1 FROM written_attempts a WHERE a.id = written_answers.attempt_id));
