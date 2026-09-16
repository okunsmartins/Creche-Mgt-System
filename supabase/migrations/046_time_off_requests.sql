-- =============================================================================
-- Migration 046: Teacher time-off requests
-- =============================================================================
-- Teachers submit time-off requests; admins approve or reject them. Status uses
-- TEXT + CHECK (not an enum) to avoid the ALTER TYPE-in-transaction gotcha.
-- Reads go through the service-role admin client scoped by teacher_id/school_id
-- (same pattern as the rest of the teacher/admin portal), so RLS is enabled as
-- defence-in-depth and no authenticated policy / is_admin_of_school() is used.

CREATE TABLE public.time_off_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  review_note  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT time_off_dates_ordered CHECK (end_date >= start_date)
);

CREATE INDEX idx_time_off_school  ON public.time_off_requests(school_id, status, created_at DESC);
CREATE INDEX idx_time_off_teacher ON public.time_off_requests(teacher_id, created_at DESC);

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_time_off_updated_at
  BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- Writes + reads are performed by the service-role admin client (server actions +
-- pages scoped manually by teacher_id/school_id). No authenticated policy is
-- required; RLS-on with no policy denies direct anon/authenticated access.

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.time_off_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_off_requests TO service_role;
