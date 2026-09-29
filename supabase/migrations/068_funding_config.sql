-- =============================================================================
-- Migration 068: Funding scheme config (ECCE/NCS) + per-tenant funding settings
-- =============================================================================
-- FEE-03. Two tables:
--   * funding_scheme_versions — NATIONAL, effective-dated reference rates (ECCE
--     capitation, NCS universal rate + caps). Platform-seeded; the subvention
--     engine (FEE-05) reads the version applicable to a billing date. NOT
--     tenant-scoped. Status/scheme use TEXT + CHECK (no ALTER TYPE gotcha).
--   * tenant_funding_settings — per-school toggles + the billing model (ADR-002).
-- Reads go through the service-role admin client; RLS is enabled as
-- defence-in-depth (no authenticated policy), matching migration 046.
--
-- Seeded rates are 2025/26 REFERENCE values and MUST be confirmed against the
-- current Pobal circular before go-live (see docs/design/fee-subvention-engine.md §7).

-- ─── funding_scheme_versions (national, effective-dated) ─────────────────────
CREATE TABLE public.funding_scheme_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme         TEXT NOT NULL CHECK (scheme IN ('ECCE', 'NCS_UNIVERSAL')),
  effective_from DATE NOT NULL,
  effective_to   DATE,                    -- NULL = open-ended current version
  params         JSONB NOT NULL,
  source_ref     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT funding_version_dates_ordered
    CHECK (effective_to IS NULL OR effective_to > effective_from),
  -- Prevent duplicate start dates per scheme. Full non-overlap is an app/seed
  -- invariant; resolveSchemeVersion() picks the latest start on/at a date.
  CONSTRAINT funding_version_scheme_from_unique UNIQUE (scheme, effective_from)
);

CREATE INDEX idx_funding_versions_scheme
  ON public.funding_scheme_versions(scheme, effective_from DESC);

-- ─── tenant_funding_settings (per-school) ────────────────────────────────────
CREATE TABLE public.tenant_funding_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                 UUID NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  ecce_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  ncs_enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  higher_capitation_default BOOLEAN NOT NULL DEFAULT FALSE,
  subvention_billing_model  TEXT NOT NULL DEFAULT 'BILL_ON_CONTRACTED'
    CHECK (subvention_billing_model IN ('BILL_ON_CONTRACTED', 'RECONCILE_ON_ATTENDANCE')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_tenant_funding_settings_updated_at
  BEFORE UPDATE ON public.tenant_funding_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS (defence-in-depth; service-role client does the work) ────────────────
ALTER TABLE public.funding_scheme_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_funding_settings ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.funding_scheme_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_scheme_versions TO service_role;
GRANT SELECT ON public.tenant_funding_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_funding_settings TO service_role;

-- ─── Seed: 2025/26 REFERENCE rates — CONFIRM against the Pobal circular ───────
INSERT INTO public.funding_scheme_versions (scheme, effective_from, effective_to, params, source_ref)
VALUES
  ('ECCE', DATE '2025-09-01', NULL,
   '{"capitation_standard_weekly_cents":6900,"capitation_higher_weekly_cents":8025,"max_hours_per_day":3,"max_hours_per_week":15,"weeks_per_year":38}'::jsonb,
   'REFERENCE 2025/26 — CONFIRM with Pobal circular'),
  ('NCS_UNIVERSAL', DATE '2025-09-01', NULL,
   '{"hourly_rate_cents":214,"max_hours_working":45,"max_hours_not_working":20,"min_age_weeks":24,"max_age_years":15,"income_assessed_max_hourly_rate_cents":510}'::jsonb,
   'REFERENCE 2025/26 — CONFIRM with Pobal circular');
