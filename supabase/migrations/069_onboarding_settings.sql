-- =============================================================================
-- Migration 069: Onboarding config toggles (the "both ways" questions)
-- =============================================================================
-- CFG-01. Extends tenant_funding_settings (mig 068) with the finite per-tenant
-- choices a manager makes so onboarding + the fee engine can work "both ways":
--   * fee_model        — one flat fee per child, or fees that vary by session type
--   * gross_fee_basis  — whether a recorded fee is before or after NCS/ECCE subsidy
--   * deposits_enabled — whether the tenant tracks deposits / registration fees
-- All TEXT + CHECK / BOOLEAN with safe defaults so existing tenants keep the
-- standard behaviour. No new grants needed (columns on an already-granted table).

ALTER TABLE public.tenant_funding_settings
  ADD COLUMN IF NOT EXISTS fee_model TEXT NOT NULL DEFAULT 'FLAT_PER_CHILD'
    CONSTRAINT tenant_funding_fee_model_values
    CHECK (fee_model IN ('FLAT_PER_CHILD', 'PER_SESSION_TYPE')),
  ADD COLUMN IF NOT EXISTS gross_fee_basis TEXT NOT NULL DEFAULT 'BEFORE_SUBSIDY'
    CONSTRAINT tenant_funding_gross_basis_values
    CHECK (gross_fee_basis IN ('BEFORE_SUBSIDY', 'AFTER_SUBSIDY')),
  ADD COLUMN IF NOT EXISTS deposits_enabled BOOLEAN NOT NULL DEFAULT FALSE;
