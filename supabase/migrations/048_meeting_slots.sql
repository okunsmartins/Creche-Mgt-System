-- =============================================================================
-- Migration 048: Parent–teacher meeting slots
-- =============================================================================
-- Teachers publish availability as DISCRETE slot rows (generated server-side
-- from an availability block). A booking lives on the slot row itself
-- (booked_parent_id / booked_student_id / booked_at — all NULL = free), and is
-- claimed with an atomic conditional UPDATE (... WHERE booked_parent_id IS NULL),
-- which makes double-booking impossible without locks.
--
-- Times are WALL-CLOCK (DATE + TIME, not timestamptz): teachers and parents of
-- one school share a timezone, so wall-clock storage sidesteps UTC/server-tz
-- conversion bugs entirely.
--
-- Reads/writes go through the service-role admin client scoped by
-- teacher_id / school_id / parent id (portal-wide pattern). RLS is enabled as
-- deny-by-default defence-in-depth; no is_admin_of_school() (absent in prod).

CREATE TABLE public.meeting_slots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id        UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  slot_date         DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  booked_parent_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  booked_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  booked_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT meeting_slot_times_ordered CHECK (end_time > start_time),
  -- Prevents duplicate slot generation for the same teacher/date/time.
  CONSTRAINT meeting_slot_unique UNIQUE (teacher_id, slot_date, start_time)
);

CREATE INDEX idx_meeting_slots_teacher ON public.meeting_slots(teacher_id, slot_date, start_time);
CREATE INDEX idx_meeting_slots_parent
  ON public.meeting_slots(booked_parent_id)
  WHERE booked_parent_id IS NOT NULL;

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_meeting_slots_updated_at
  BEFORE UPDATE ON public.meeting_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.meeting_slots ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: RLS-on with no policy denies direct access;
-- the app reads/writes via the service-role client with explicit scoping.

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.meeting_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_slots TO service_role;
