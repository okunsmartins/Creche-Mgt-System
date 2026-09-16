-- =============================================================================
-- Migration 054: track whether a school's subdomain is actually live in DNS
-- =============================================================================
-- `schools.subdomain` may be set even when the matching DNS record / Vercel
-- domain was never provisioned (older schools created before auto-provisioning,
-- or a provisioning failure). This flag records whether `<subdomain>.<root>` is
-- actually reachable, so branded PUBLIC urls (pay-by-link) only use the
-- subdomain when it resolves — otherwise they fall back to the apex app URL and
-- a shared payment link never points at a dead host.
--
-- Set TRUE automatically by provisionSchool after a successful auto-provision
-- (see src/lib/tenant/provision.ts + domainProvision.ts). Backfills the two
-- subdomains that are already live in DNS (stmarys = manual, stpaul = auto).
--
-- schools already has GRANT ALL to service_role (migration 019), so no new
-- grants are needed.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS subdomain_provisioned BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.schools
  SET subdomain_provisioned = TRUE
  WHERE subdomain IN ('stmarys', 'stpaul');
