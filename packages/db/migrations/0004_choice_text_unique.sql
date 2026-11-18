-- RV-02: a deferred count query cannot prevent write skew across two writers.
-- A unique index arbitrates conflicting keys across transactions, including
-- uncommitted rows. Keep the same normalization as migration 0003.
CREATE UNIQUE INDEX question_choices_distinct_text
  ON question_choices (revision_id, lower(btrim(text)));
