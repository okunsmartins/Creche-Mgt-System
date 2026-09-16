-- =============================================================================
-- Migration 012: Teachers
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.teachers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  email      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_teachers_names_not_empty
    CHECK (trim(first_name) <> '' AND trim(last_name) <> '')
);

-- Indexes
CREATE INDEX idx_teachers_school_id ON public.teachers(school_id);
CREATE INDEX idx_teachers_active    ON public.teachers(school_id, is_active);

-- Trigger
CREATE TRIGGER trg_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Admins can fully manage teachers
CREATE POLICY "admins_manage_teachers" ON public.teachers
  FOR ALL USING (public.is_admin());

-- Authenticated users (parents, teachers) can read active teachers
-- (needed for payer-facing class/teacher display)
CREATE POLICY "authenticated_read_active_teachers" ON public.teachers
  FOR SELECT TO authenticated USING (is_active = TRUE);

-- Anon users can read active teachers (needed for guest payment class display)
CREATE POLICY "anon_read_active_teachers" ON public.teachers
  FOR SELECT TO anon USING (is_active = TRUE);
