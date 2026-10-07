-- =============================================================================
-- Migration 099: Staff on duty per room per day
-- =============================================================================
-- The number of staff on duty in a room on a given day, saved from /admin/ratios. Drives
-- the dashboard ratio alert: a room is flagged when the staff on duty (this saved number
-- if set for today, otherwise the rostered count from the rota) can't cover the children
-- present now at the crèche's configured ratios. One row per room per day.
--
-- Conventions: school_id-scoped, set_updated_at trigger (003), RLS on, explicit grants.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.room_staff_on_duty (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  on_date     DATE NOT NULL,
  staff_count INTEGER NOT NULL CHECK (staff_count >= 0),
  updated_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, class_id, on_date)
);

CREATE INDEX idx_room_staff_on_duty_day ON public.room_staff_on_duty(school_id, on_date);

CREATE TRIGGER trg_room_staff_on_duty_updated_at
  BEFORE UPDATE ON public.room_staff_on_duty
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.room_staff_on_duty ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.room_staff_on_duty TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_staff_on_duty TO service_role;
