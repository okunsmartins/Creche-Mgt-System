-- 059_drop_subdomain_provisioned.sql
-- Single-domain (Aladdin-style) tenancy: per-school subdomain provisioning was
-- removed. The `subdomain_provisioned` flag is no longer read or written by any
-- code, so drop it.
--
-- ⚠️ Apply AFTER the code that removed the column's readers is deployed
-- (this migration's PR), so there's no window where old code selects a
-- now-missing column. Idempotent.
--
-- The `subdomain` column is kept: host-based resolution (existing
-- <sub>.<root> links) still works via getTenantSubdomain.

ALTER TABLE public.schools
  DROP COLUMN IF EXISTS subdomain_provisioned;
