-- =============================================================================
-- Migration 088: Funding & Hive Centre — Phase 5 (AIM, restricted domain)
-- =============================================================================
-- Additive. AIM (Access and Inclusion Model) is the most SENSITIVE funding domain:
-- it concerns a child's additional needs. Creche Wise models it as a restricted case
-- file that:
--   * is gated behind its own `funding.manage_aim` permission (seeded UNGRANTED in
--     migration 084 — the owner grants it deliberately, after a privacy review);
--   * requires recorded parental/guardian CONSENT before anything is prepared for Hive;
--   * holds only a brief, non-clinical support summary + an optional evidence document
--     reference — it NEVER copies general health/developmental records (those stay in
--     their own modules and are referenced, not duplicated).
--
-- Conventions (match 071/083/084/085/086): TEXT + CHECK enums, school_id-scoped,
-- set_updated_at trigger (003), RLS on, explicit grants (no default privileges).
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl). ALTER TYPE
--    ADD VALUE adds the AIM audit actions used by the app's audit() helper; the new
--    values are not used elsewhere in this migration, so it is transaction-safe.

-- ── Audit action codes for AIM (mirror migrations 022/028) ─────────────────────
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'aim.case_created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'aim.case_updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'aim.consent_recorded';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'aim.submitted';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'aim.closed';

-- ── aim_cases (one restricted case per child per tenant) ───────────────────────
CREATE TABLE public.aim_cases (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id           UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  -- AIM level 1–7 (Level 7 = additional in-room assistance). Nullable while preparing.
  aim_level            INTEGER CHECK (aim_level IS NULL OR (aim_level BETWEEN 1 AND 7)),
  status               TEXT NOT NULL DEFAULT 'PREPARING'
                         CHECK (status IN ('PREPARING','CONSENT_RECORDED','READY','SUBMITTED_EXTERNALLY','CLOSED')),
  -- Parental/guardian consent — the hard gate before anything is prepared for Hive.
  consent_status       TEXT NOT NULL DEFAULT 'NOT_REQUESTED'
                         CHECK (consent_status IN ('NOT_REQUESTED','REQUESTED','GRANTED','DECLINED','WITHDRAWN')),
  consent_recorded_at  TIMESTAMPTZ,
  consent_recorded_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Brief, NON-CLINICAL summary only. Never general health/developmental records.
  support_summary      TEXT,
  evidence_document_id UUID,
  prepared_at          TIMESTAMPTZ,
  submitted_at         TIMESTAMPTZ,
  submitted_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_aim_case_child UNIQUE (school_id, student_id)
);

CREATE INDEX idx_aim_case_scope ON public.aim_cases(school_id, status);

CREATE TRIGGER trg_aim_cases_updated_at
  BEFORE UPDATE ON public.aim_cases
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
-- RLS is defence-in-depth; the service-role client does the work and scopes by
-- school_id, and the APP additionally gates every read/write on funding.manage_aim.
ALTER TABLE public.aim_cases ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.aim_cases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aim_cases TO service_role;
