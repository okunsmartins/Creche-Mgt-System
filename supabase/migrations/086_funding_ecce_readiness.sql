-- =============================================================================
-- Migration 086: Funding & Hive Centre — Phase 3 (ECCE & Programme Readiness)
-- =============================================================================
-- Additive. Extends child_funding_registrations with the ECCE prep/submission
-- workflow fields (reuse — PPSN + ecce_session already exist from 071/084), and adds
-- a per-tenant Programme Readiness checklist.
--
-- Conventions (match 071/083/084/085): TEXT + CHECK enums, school_id-scoped,
-- set_updated_at trigger (003), RLS on, explicit grants (no default privileges).
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

-- ── ECCE registration workflow (additive columns, nullable) ────────────────────
ALTER TABLE public.child_funding_registrations
  ADD COLUMN IF NOT EXISTS aim_level_7 BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS ecce_registration_prepared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ecce_registration_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ecce_registration_submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ── Programme Readiness checklist (one row per tenant × programme year × item) ──
CREATE TABLE public.funding_readiness_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  programme_year       TEXT NOT NULL,
  item_key             TEXT NOT NULL,
  label                TEXT NOT NULL,
  category             TEXT,
  status               TEXT NOT NULL DEFAULT 'MISSING'
                         CHECK (status IN ('CURRENT','REVIEW_REQUIRED','MISSING','SUBMITTED','NOT_APPLICABLE')),
  due_date             DATE,
  evidence_document_id UUID,
  notes                TEXT,
  updated_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_readiness_item UNIQUE (school_id, programme_year, item_key)
);

CREATE INDEX idx_readiness_scope
  ON public.funding_readiness_items(school_id, programme_year, status);

CREATE TRIGGER trg_funding_readiness_items_updated_at
  BEFORE UPDATE ON public.funding_readiness_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.funding_readiness_items ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.funding_readiness_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_readiness_items TO service_role;
