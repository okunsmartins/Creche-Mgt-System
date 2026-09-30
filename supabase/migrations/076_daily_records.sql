-- =============================================================================
-- Migration 076: Daily records (sleep / nappy / meal / incident / medication)
-- =============================================================================
-- Spec §7.6. Timestamped care events per child per day (many per child/day). The
-- `type` categorises the entry; `note` holds the human detail; `details` JSONB is
-- available for structured fields later without a schema change.
--
-- Conventions (match 070–075): TEXT + CHECK enum, school_id-scoped, set_updated_at
-- trigger, RLS on as defence-in-depth, explicit grants (no default privileges).

CREATE TABLE public.daily_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date         DATE NOT NULL,
  type         TEXT NOT NULL CHECK (type IN ('sleep', 'nappy', 'meal', 'incident', 'medication')),
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note         TEXT,
  details      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX idx_daily_records_child_date ON public.daily_records(school_id, student_id, date);

CREATE TRIGGER trg_daily_records_updated_at
  BEFORE UPDATE ON public.daily_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS (defence-in-depth; service-role client does the work) ────────────────
ALTER TABLE public.daily_records ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.daily_records TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_records TO service_role;
