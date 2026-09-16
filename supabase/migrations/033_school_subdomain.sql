-- =============================================================================
-- Migration 033: Multi-tenant — school subdomain for tenant resolution
-- =============================================================================
-- Adds a `subdomain` to schools so a request's host (e.g. stmarys.example.ie)
-- can be mapped to the correct school. This is the first step of multi-tenant
-- support; public pages resolve the tenant from the host, falling back to the
-- configured default school when no subdomain is present (single-tenant safe).
--
-- schools already has SELECT grants for anon/authenticated (migration 021) and
-- DML for service_role (migration 020), so no new grants are required.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS subdomain TEXT;

-- Unique per tenant (nullable until a school is assigned one)
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_subdomain
  ON public.schools(subdomain) WHERE subdomain IS NOT NULL;

-- Backfill the existing demo school
UPDATE public.schools
SET subdomain = 'scoildemo'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND subdomain IS NULL;
