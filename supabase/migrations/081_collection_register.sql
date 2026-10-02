-- =============================================================================
-- Migration 081: School Collection Service (Feature A) — Slice 3: daily register
-- =============================================================================
-- Design: docs/design/school-collection-and-authorised-collectors.md
-- One row per enrolled child per collection day: the lifecycle of being collected
-- from their primary school and later released to an authorised collector. Ties
-- Feature A (runs/enrolments) to Feature B (authorised_collectors).
--
-- Conventions (match 070–080): TEXT + CHECK enum, school_id-scoped, set_updated_at
-- trigger, RLS on as defence-in-depth, explicit grants (no default privileges).

CREATE TABLE public.collection_register (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                 UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  collection_run_id         UUID NOT NULL REFERENCES public.collection_runs(id) ON DELETE CASCADE,
  student_id                UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date                      DATE NOT NULL,
  status                    TEXT NOT NULL DEFAULT 'scheduled'
                              CHECK (status IN ('scheduled','collected','released','absent')),
  collected_at              TIMESTAMPTZ,
  released_at               TIMESTAMPTZ,
  released_to_collector_id  UUID REFERENCES public.authorised_collectors(id) ON DELETE SET NULL,
  recorded_by_profile_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes                     TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_register_run_student_date UNIQUE (collection_run_id, student_id, date)
);

CREATE INDEX idx_collection_register_scope
  ON public.collection_register(school_id, date, collection_run_id);

CREATE TRIGGER trg_collection_register_updated_at
  BEFORE UPDATE ON public.collection_register
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS (defence-in-depth; the service-role client does the work) ─────────────
ALTER TABLE public.collection_register ENABLE ROW LEVEL SECURITY;

-- ── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.collection_register TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_register TO service_role;
