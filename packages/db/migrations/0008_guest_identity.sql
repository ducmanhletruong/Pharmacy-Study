-- Guest identities use independent random subjects, never a shared user.
ALTER TABLE auth_identities DROP CONSTRAINT auth_identities_provider_check;
ALTER TABLE auth_identities ADD CONSTRAINT auth_identities_provider_check
 CHECK (provider IN ('google','test','guest'));
