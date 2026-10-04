-- =============================================================================
-- Migration 085: Funding & Hive Centre — Phase 2 (NCS claims & co-payment)
-- =============================================================================
-- Additive. ncs_claim_versions holds the versioned NCS claim lifecycle and the
-- prepared parent co-payment (the 31 July 2026 mandatory co-payment). It references
-- the existing child funding registration (the CHICK award) and the existing fee
-- schedule; it does NOT duplicate child, fee or billing data.
--
-- Conventions (match 071/083/084): TEXT + CHECK enums, school_id-scoped,
-- set_updated_at trigger (migration 003), RLS on, explicit grants (no default
-- privileges — migrations 019–021). All money is integer cents.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.ncs_claim_versions (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id                    UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  -- The CHICK award this claim is prepared under (reuse, don't copy).
  funding_registration_id       UUID REFERENCES public.child_funding_registrations(id) ON DELETE SET NULL,
  status                        TEXT NOT NULL DEFAULT 'DRAFT'
                                  CHECK (status IN ('DRAFT','READY','VERIFIED','SUBMITTED_EXTERNALLY','SUPERSEDED')),
  start_date                    DATE NOT NULL,
  end_date                      DATE,
  -- Weekly subsidised-hour pattern (minutes), term vs non-term.
  term_minutes                  INTEGER NOT NULL DEFAULT 0 CHECK (term_minutes >= 0),
  non_term_minutes              INTEGER NOT NULL DEFAULT 0 CHECK (non_term_minutes >= 0),
  -- Co-payment inputs + result (all cents). Snapshot of the formula inputs.
  weekly_fee_cents              INTEGER CHECK (weekly_fee_cents IS NULL OR weekly_fee_cents >= 0),
  weekly_childcare_minutes      INTEGER CHECK (weekly_childcare_minutes IS NULL OR weekly_childcare_minutes >= 0),
  ncs_subsidy_cents             INTEGER NOT NULL DEFAULT 0 CHECK (ncs_subsidy_cents >= 0),
  ecce_subsidy_cents            INTEGER NOT NULL DEFAULT 0 CHECK (ecce_subsidy_cents >= 0),
  discount_cents                INTEGER NOT NULL DEFAULT 0 CHECK (discount_cents >= 0),
  calculated_copayment_cents    INTEGER CHECK (calculated_copayment_cents IS NULL OR calculated_copayment_cents >= 0),
  -- Verified override (permission + reason required at the app layer).
  manual_override_cents         INTEGER CHECK (manual_override_cents IS NULL OR manual_override_cents >= 0),
  override_reason               TEXT,
  -- The existing billing fee schedule this claim was prepared from (reuse).
  source_fee_schedule_id        UUID REFERENCES public.fee_schedules(id) ON DELETE SET NULL,
  calculation_version           TEXT,
  prepared_at                   TIMESTAMPTZ,
  verified_by                   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  verified_at                   TIMESTAMPTZ,
  external_submitted_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  external_submitted_at         TIMESTAMPTZ,
  created_by                    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_claim_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_ncs_claim_scope
  ON public.ncs_claim_versions(school_id, student_id, status);

CREATE TRIGGER trg_ncs_claim_versions_updated_at
  BEFORE UPDATE ON public.ncs_claim_versions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.ncs_claim_versions ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.ncs_claim_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ncs_claim_versions TO service_role;
