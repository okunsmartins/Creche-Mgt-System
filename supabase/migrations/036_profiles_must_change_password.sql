-- =============================================================================
-- Migration 036: profiles.must_change_password — force first-login password change
-- =============================================================================
-- Set TRUE when a login is provisioned with a temporary password (e.g. teacher
-- invites). Protected route-group guards redirect such users to /change-password
-- until they set their own password, which clears the flag.
--
-- Additive and safe: defaults FALSE so existing users are unaffected. No new
-- grants (service_role already has DML on profiles; authenticated has SELECT).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
