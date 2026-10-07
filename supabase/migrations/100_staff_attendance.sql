-- =============================================================================
-- Migration 100: Staff attendance (manager-recorded clock in / clock out)
-- =============================================================================
-- Records when a staff member actually clocked in and out each day, entered by a manager
-- on the Staff clock-in board (like the child daily check-in). One row per staff per day.
-- Standalone log + report for now; it does not feed the rota-seeded timesheets.
--
-- Conventions: school_id-scoped, set_updated_at trigger (003), RLS on, explicit grants.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.staff_attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  work_date    DATE NOT NULL,
  clock_in_at  TIMESTAMPTZ,
  clock_out_at TIMESTAMPTZ,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_staff_attendance_times
    CHECK (clock_out_at IS NULL OR clock_in_at IS NULL OR clock_out_at >= clock_in_at),
  UNIQUE (school_id, teacher_id, work_date)
);

CREATE INDEX idx_staff_attendance_day ON public.staff_attendance(school_id, work_date);
CREATE INDEX idx_staff_attendance_staff ON public.staff_attendance(school_id, teacher_id, work_date);

CREATE TRIGGER trg_staff_attendance_updated_at
  BEFORE UPDATE ON public.staff_attendance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.staff_attendance ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.staff_attendance TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_attendance TO service_role;
