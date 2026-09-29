-- =============================================================================
-- Migration 073: Daily check-in / check-out (crèche arrivals & departures)
-- =============================================================================
-- The crèche's daily register: one row per child per day recording arrival and
-- departure times. "Present now" = checked_in_at IS NOT NULL AND checked_out_at
-- IS NULL, which powers live room ratios (spec §7.4/7.5) and daily attendance.
-- Distinct from the inherited per-class-session attendance (migrations 031/032).
--
-- Conventions (match migrations 070–072): TEXT + CHECK for enums, school_id-scoped,
-- set_updated_at trigger, RLS on as defence-in-depth, explicit grants (no default
-- privileges — see migrations 019–021). One record per (child, day).

CREATE TABLE public.daily_check_ins (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  date            DATE NOT NULL,
  checked_in_at   TIMESTAMPTZ,
  checked_out_at  TIMESTAMPTZ,
  -- 'expected' = on the register but not yet arrived; 'absent' = marked not coming.
  status          TEXT NOT NULL DEFAULT 'present'
                    CHECK (status IN ('present', 'absent', 'expected')),
  note            TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT chk_checkin_times
    CHECK (checked_out_at IS NULL OR checked_in_at IS NULL OR checked_out_at >= checked_in_at),
  CONSTRAINT uq_check_in_per_child_day UNIQUE (student_id, date)
);

CREATE INDEX idx_check_ins_school_date ON public.daily_check_ins(school_id, date);

CREATE TRIGGER trg_check_ins_updated_at
  BEFORE UPDATE ON public.daily_check_ins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS (defence-in-depth; service-role client does the work) ────────────────
ALTER TABLE public.daily_check_ins ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.daily_check_ins TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_check_ins TO service_role;
