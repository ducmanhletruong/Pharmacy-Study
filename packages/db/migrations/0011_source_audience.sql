-- Preserve existing sources and require an explicit decision to widen access.
ALTER TABLE sources
 ADD COLUMN audience text NOT NULL DEFAULT 'owner_only',
 ADD CONSTRAINT sources_audience_check CHECK (audience IN ('owner_only','class','public'));

GRANT UPDATE(audience) ON sources TO app_rw;
