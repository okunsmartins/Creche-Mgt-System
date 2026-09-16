-- =============================================================================
-- Migration 053: school logo (column + public storage bucket)
-- =============================================================================
-- Adds per-tenant logo support:
--   1. schools.logo_url — public URL of the uploaded crest (NULL = use initials).
--   2. A PUBLIC storage bucket `school-logos` for the image files.
--
-- Uploads happen server-side via the service-role client (see
-- src/lib/schools/actions.ts), which bypasses storage RLS, so no write policies
-- are required. The bucket is public, so the logo is readable via its public URL
-- with no read policy. schools already has GRANT ALL to service_role (migration
-- 019), so the new column needs no additional grants.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;
