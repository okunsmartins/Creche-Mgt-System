-- =============================================================================
-- Migration 071: Fee schedules, child funding registrations, invoices
-- =============================================================================
-- FEE-01 / FEE-04. The billing spine that makes the tested pure engines usable:
--   * child_funding_registrations — per-child ECCE/NCS award data (authoritative,
--     entered by the provider from the CHICK award). Read by the subvention engine
--     (src/lib/payments/subvention.ts). PPSN stored ENCRYPTED (src/lib/crypto).
--   * fee_schedules — a child's recurring fee plan (frequency + provider rate +
--     contracted weekly hours). Feeds generateFeeSchedule (src/lib/fees/schedule.ts)
--     and computePeriodSubvention.
--   * invoices — the dated, subvention-netted obligations. IMMUTABLE once issued:
--     we snapshot every rate/band/scheme-version used, so a later config change
--     never rewrites history (enforced in the app layer + guard trigger below).
--
-- Conventions (match migrations 068/070): TEXT + CHECK for enums (no ALTER TYPE
-- gotcha), school_id-scoped, set_updated_at trigger, RLS on as defence-in-depth,
-- explicit grants (this project has NO default privileges — see migrations 019–021).

-- ─── child_funding_registrations (authoritative award data) ───────────────────
CREATE TABLE public.child_funding_registrations (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                 UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id                UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  scheme                    TEXT NOT NULL CHECK (scheme IN ('ECCE', 'NCS')),
  status                    TEXT NOT NULL DEFAULT 'PENDING'
                              CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED')),
  start_date                DATE,
  end_date                  DATE,
  -- NCS-specific (from the CHICK award — AUTHORITATIVE, never recomputed here):
  chick_code                TEXT,
  ncs_subsidy_type          TEXT CHECK (ncs_subsidy_type IN ('UNIVERSAL', 'INCOME_ASSESSED')),
  awarded_hourly_rate_cents INTEGER CHECK (awarded_hourly_rate_cents IS NULL OR awarded_hourly_rate_cents >= 0),
  awarded_weekly_hours      NUMERIC(5, 2) CHECK (awarded_weekly_hours IS NULL OR awarded_weekly_hours >= 0),
  -- ECCE-specific:
  ecce_programme_year       TEXT,
  higher_capitation         BOOLEAN NOT NULL DEFAULT FALSE,
  -- Sensitive (special-category): PPSN, encrypted at rest via src/lib/crypto. Never log.
  pps_number_encrypted      TEXT,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_funding_reg_dates
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_funding_reg_scope
  ON public.child_funding_registrations(school_id, student_id, scheme, status);

-- At most one ACTIVE registration per (child, scheme). Overlapping-period rules
-- beyond this are enforced in the app layer (see design doc §2.2).
CREATE UNIQUE INDEX uq_funding_reg_one_active
  ON public.child_funding_registrations(student_id, scheme)
  WHERE status = 'ACTIVE';

CREATE TRIGGER trg_funding_reg_updated_at
  BEFORE UPDATE ON public.child_funding_registrations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── fee_schedules (a child's recurring fee plan) ─────────────────────────────
CREATE TABLE public.fee_schedules (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                 UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id                UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  name                      TEXT NOT NULL,
  frequency                 TEXT NOT NULL
                              CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'annually')),
  -- Money maths: gross is provider_hourly_rate × contracted hours, UNLESS a flat
  -- amount is set (fixed weekly/monthly fee that bypasses the hours calc).
  provider_hourly_rate_cents INTEGER CHECK (provider_hourly_rate_cents IS NULL OR provider_hourly_rate_cents >= 0),
  flat_amount_cents         INTEGER CHECK (flat_amount_cents IS NULL OR flat_amount_cents >= 0),
  -- Contracted attendance as hours per operating day, e.g. [8,8,8,8,8] for Mon–Fri.
  contracted_day_hours      JSONB NOT NULL DEFAULT '[]'::jsonb,
  start_date                DATE NOT NULL,
  end_date                  DATE NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'paused', 'ended')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_fee_schedule_dates CHECK (end_date >= start_date),
  -- Must have some basis for the gross fee.
  CONSTRAINT chk_fee_schedule_amount
    CHECK (flat_amount_cents IS NOT NULL OR provider_hourly_rate_cents IS NOT NULL)
);

CREATE INDEX idx_fee_schedules_scope
  ON public.fee_schedules(school_id, student_id, status);

CREATE TRIGGER trg_fee_schedules_updated_at
  BEFORE UPDATE ON public.fee_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── invoices (dated, subvention-netted obligations; immutable once issued) ────
CREATE TABLE public.invoices (
  id                             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id                     UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  fee_schedule_id                UUID REFERENCES public.fee_schedules(id) ON DELETE SET NULL,
  invoice_number                 TEXT NOT NULL,
  period_start                   DATE NOT NULL,
  period_end                     DATE NOT NULL,
  due_date                       DATE NOT NULL,
  basis                          TEXT NOT NULL DEFAULT 'CONTRACTED'
                                   CHECK (basis IN ('CONTRACTED', 'ATTENDED')),
  -- Money breakdown (cents), mirrors PeriodSubvention from the tested engine:
  gross_parent_cents             INTEGER NOT NULL DEFAULT 0,
  ecce_zero_rated_hours          NUMERIC(7, 2) NOT NULL DEFAULT 0,
  ncs_subsidised_hours           NUMERIC(7, 2) NOT NULL DEFAULT 0,
  ncs_subsidy_cents              INTEGER NOT NULL DEFAULT 0,
  discount_cents                 INTEGER NOT NULL DEFAULT 0,
  net_parent_cents               INTEGER NOT NULL DEFAULT 0,
  provider_receivable_ecce_cents INTEGER NOT NULL DEFAULT 0,
  provider_receivable_ncs_cents  INTEGER NOT NULL DEFAULT 0,
  amount_paid_cents              INTEGER NOT NULL DEFAULT 0,
  status                         TEXT NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft', 'issued', 'paid', 'part_paid', 'void')),
  -- Link to the payment order once the parent pays (reuses existing orders table).
  order_id                       UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  -- Immutable snapshot at issue: scheme_version_ids, awarded rates/band, per-week
  -- breakdown. What makes a historical invoice reproducible + audit-safe.
  snapshot                       JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at                      TIMESTAMPTZ,
  created_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by                     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_invoice_period CHECK (period_end >= period_start),
  CONSTRAINT uq_invoice_number_per_school UNIQUE (school_id, invoice_number)
);

CREATE INDEX idx_invoices_due    ON public.invoices(school_id, due_date);
CREATE INDEX idx_invoices_child  ON public.invoices(school_id, student_id, period_start);
CREATE INDEX idx_invoices_status ON public.invoices(school_id, status);

CREATE TRIGGER trg_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Immutability guard: once an invoice leaves 'draft', its financial fields and
-- period are frozen. Only status, amount_paid_cents and order_id may still change
-- (payment lifecycle). Voiding is allowed. Defence-in-depth on top of app logic.
CREATE OR REPLACE FUNCTION public.guard_issued_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status <> 'draft' THEN
    IF NEW.gross_parent_cents             IS DISTINCT FROM OLD.gross_parent_cents
    OR NEW.net_parent_cents               IS DISTINCT FROM OLD.net_parent_cents
    OR NEW.ncs_subsidy_cents              IS DISTINCT FROM OLD.ncs_subsidy_cents
    OR NEW.discount_cents                 IS DISTINCT FROM OLD.discount_cents
    OR NEW.provider_receivable_ecce_cents IS DISTINCT FROM OLD.provider_receivable_ecce_cents
    OR NEW.provider_receivable_ncs_cents  IS DISTINCT FROM OLD.provider_receivable_ncs_cents
    OR NEW.period_start                   IS DISTINCT FROM OLD.period_start
    OR NEW.period_end                     IS DISTINCT FROM OLD.period_end
    OR NEW.snapshot                       IS DISTINCT FROM OLD.snapshot THEN
      RAISE EXCEPTION 'Invoice % is issued and its financial fields are immutable', OLD.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_invoices_guard_issued
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.guard_issued_invoice();

-- Invoice number: INV-YYYY-NNNNNN (reuses the race-safe sequence from migration 002).
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_seq  BIGINT  := public.next_reference_val('INV');
BEGIN
  RETURN 'INV-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- ─── RLS (defence-in-depth; service-role client does the work) ────────────────
ALTER TABLE public.child_funding_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fee_schedules               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices                    ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;

-- child_funding_registrations holds special-category data (PPSN/CHICK). NOT granted
-- to `authenticated` — reads go through the service-role admin client only.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_funding_registrations TO service_role;

GRANT SELECT ON public.fee_schedules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_schedules TO service_role;

GRANT SELECT ON public.invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO service_role;
