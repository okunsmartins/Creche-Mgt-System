-- =============================================================================
-- Migration 080: School Collection Service (Feature A) — Slice 2: enrolment
-- =============================================================================
-- Design: docs/design/school-collection-and-authorised-collectors.md
-- A child is enrolled in a collection run. A parent can request it (with written
-- consent) or staff can enrol directly; the crèche approves. An approved enrolment
-- can then be charged — each charge is an invoice (reuses the existing invoices
-- table + fee engine), linked back here via invoices.collection_enrolment_id.
--
-- Conventions (match 070–079): TEXT + CHECK enum, school_id-scoped, set_updated_at
-- trigger, RLS on as defence-in-depth, explicit grants (no default privileges).

CREATE TABLE public.collection_enrolments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id               UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  collection_run_id        UUID NOT NULL REFERENCES public.collection_runs(id) ON DELETE CASCADE,
  days                     SMALLINT[] NOT NULL DEFAULT '{}',  -- which of the run's days this child needs
  status                   TEXT NOT NULL DEFAULT 'requested'
                             CHECK (status IN ('requested','approved','declined','ended')),
  requested_by             TEXT NOT NULL DEFAULT 'staff'
                             CHECK (requested_by IN ('parent','staff')),
  requested_by_profile_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_by_profile_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  consent_given_at         TIMESTAMPTZ,                       -- written parental consent (Tusla)
  notes                    TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_collection_enrolments_scope
  ON public.collection_enrolments(school_id, collection_run_id, status);
CREATE INDEX idx_collection_enrolments_student
  ON public.collection_enrolments(student_id);

-- One live enrolment per child per run (requested or approved). Declined/ended
-- history doesn't block re-enrolling.
CREATE UNIQUE INDEX uq_collection_enrolment_live
  ON public.collection_enrolments(student_id, collection_run_id)
  WHERE status IN ('requested', 'approved');

CREATE TRIGGER trg_collection_enrolments_updated_at
  BEFORE UPDATE ON public.collection_enrolments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Link a collection charge (invoice) back to the enrolment that produced it.
ALTER TABLE public.invoices
  ADD COLUMN collection_enrolment_id UUID
    REFERENCES public.collection_enrolments(id) ON DELETE SET NULL;

-- ── RLS (defence-in-depth; the service-role client does the work) ─────────────
ALTER TABLE public.collection_enrolments ENABLE ROW LEVEL SECURITY;

-- ── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.collection_enrolments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_enrolments TO service_role;
