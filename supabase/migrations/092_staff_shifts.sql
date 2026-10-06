-- =============================================================================
-- Migration 092: Staff rota / shift planning (weekly rota)
-- =============================================================================
-- Phase 1 of the staff workforce module. A staff_shift is one planned shift for a
-- staff member on a given date, optionally assigned to a room. The weekly rota view
-- groups these Mon–Sun. Timesheets (Phase 2), cover alerts (Phase 3) and payroll
-- export (Phase 4) build on these scheduled shifts.
--
-- Wall-clock DATE + TIME (no timezone) to avoid tz drift (same approach as meeting
-- booking, mig 048). Conventions: school_id-scoped, set_updated_at trigger (003),
-- RLS on, explicit grants (no default privileges).
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.staff_shifts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id  UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  -- Room the staff member is rostered to cover (optional — e.g. floating/office).
  class_id    UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  shift_date  DATE NOT NULL,
  start_time  TIME NOT NULL,
  end_time    TIME NOT NULL,
  -- Optional short label (e.g. "Early", "Late", "Lunch cover").
  label       TEXT,
  notes       TEXT,
  created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_shift_times CHECK (end_time > start_time)
);

CREATE INDEX idx_staff_shift_week   ON public.staff_shifts(school_id, shift_date);
CREATE INDEX idx_staff_shift_staff  ON public.staff_shifts(school_id, teacher_id, shift_date);

CREATE TRIGGER trg_staff_shifts_updated_at
  BEFORE UPDATE ON public.staff_shifts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.staff_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_shifts TO service_role;
