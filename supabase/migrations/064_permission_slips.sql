-- =============================================================================
-- Migration 064: online permission slips
-- =============================================================================
-- Staff create a permission slip (title, description, optional due date) targeted
-- at a class or the whole school; a parent grants or declines consent per child,
-- with an optional note. One consent row per (slip, student) — any linked parent
-- can set/update it (last write wins, like the absence reason).
--
-- Reads/writes go through the service-role admin client, scoped after verifying
-- the actor (staff create authz / parent↔child link), so RLS is enabled with no
-- authenticated policy.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

CREATE TABLE public.permission_slips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('admin', 'teacher')),
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  audience_type   TEXT NOT NULL CHECK (audience_type IN ('class', 'school')),
  class_id        UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT permission_slip_class_required CHECK (audience_type <> 'class' OR class_id IS NOT NULL)
);

CREATE INDEX idx_permission_slips_school ON public.permission_slips(school_id, created_at DESC);
CREATE INDEX idx_permission_slips_class  ON public.permission_slips(class_id);

CREATE TABLE public.permission_slip_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id      UUID NOT NULL REFERENCES public.permission_slips(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  consent      BOOLEAN NOT NULL,
  note         TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slip_id, student_id)
);

CREATE INDEX idx_slip_responses_slip    ON public.permission_slip_responses(slip_id);
CREATE INDEX idx_slip_responses_student ON public.permission_slip_responses(student_id);

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_permission_slips_updated_at
  BEFORE UPDATE ON public.permission_slips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_slip_responses_updated_at
  BEFORE UPDATE ON public.permission_slip_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.permission_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_slip_responses ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.permission_slips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_slips TO service_role;
GRANT SELECT ON public.permission_slip_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_slip_responses TO service_role;
