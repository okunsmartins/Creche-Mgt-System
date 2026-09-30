-- =============================================================================
-- Migration 077: Enquiries / waiting-list CRM
-- =============================================================================
-- Spec §7.3. Capture prospective families before enrolment and track them through a
-- simple pipeline. Contact details are personal data (not special-category) — held
-- tenant-scoped, service-role access only for writes.
--
-- Conventions (match 070–076): TEXT + CHECK enum, school_id-scoped, set_updated_at
-- trigger, RLS on as defence-in-depth, explicit grants (no default privileges).

CREATE TABLE public.enquiries (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  child_first_name   TEXT,
  child_last_name    TEXT,
  child_dob          DATE,
  parent_name        TEXT NOT NULL,
  parent_email       TEXT,
  parent_phone       TEXT,
  desired_start_date DATE,
  status             TEXT NOT NULL DEFAULT 'new'
                       CHECK (status IN ('new', 'contacted', 'waitlisted', 'offered', 'enrolled', 'declined')),
  source             TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_enquiry_parent_name CHECK (trim(parent_name) <> '')
);

CREATE INDEX idx_enquiries_scope ON public.enquiries(school_id, status, created_at DESC);

CREATE TRIGGER trg_enquiries_updated_at
  BEFORE UPDATE ON public.enquiries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS (defence-in-depth; service-role client does the work) ────────────────
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.enquiries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.enquiries TO service_role;
