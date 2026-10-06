-- =============================================================================
-- Migration 093: Staff timesheets (Phase 2 of the staff workforce module)
-- =============================================================================
-- A timesheet entry records the hours a staff member actually worked for a rostered
-- shift. Entries are seeded from staff_shifts (planned times copied in; actual times
-- default to planned and can be adjusted), then APPROVED by an admin. Approved hours
-- feed the payroll export (Phase 4). One timesheet per shift (idempotent generation).
--
-- Wall-clock DATE + TIME (same as rota). Conventions: school_id-scoped, set_updated_at
-- trigger (003), RLS on, explicit grants (no default privileges).
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.staff_timesheets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id    UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  -- The rostered shift this came from (kept for de-dupe; NULLed if the shift is removed).
  shift_id      UUID REFERENCES public.staff_shifts(id) ON DELETE SET NULL,
  work_date     DATE NOT NULL,
  planned_start TIME NOT NULL,
  planned_end   TIME NOT NULL,
  actual_start  TIME NOT NULL,
  actual_end    TIME NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED')),
  approved_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at   TIMESTAMPTZ,
  notes         TEXT,
  created_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_timesheet_actual CHECK (actual_end > actual_start)
);

-- One timesheet per shift (shift_id is set at generation; NULLs after shift deletion
-- are treated as distinct by Postgres, which is fine — orphaned entries are kept).
CREATE UNIQUE INDEX uq_timesheet_shift
  ON public.staff_timesheets(school_id, shift_id)
  WHERE shift_id IS NOT NULL;
CREATE INDEX idx_timesheet_week  ON public.staff_timesheets(school_id, work_date);
CREATE INDEX idx_timesheet_staff ON public.staff_timesheets(school_id, teacher_id, work_date);

CREATE TRIGGER trg_staff_timesheets_updated_at
  BEFORE UPDATE ON public.staff_timesheets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.staff_timesheets ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.staff_timesheets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_timesheets TO service_role;
