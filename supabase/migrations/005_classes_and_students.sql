-- =============================================================================
-- Migration 005: Classes, students, parent-student links
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.classes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.students (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  class_id            UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  pupil_payment_code  TEXT NOT NULL UNIQUE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent duplicate names in the same class (soft warning — not hard unique
  -- because two children can share names; handled at application layer)
  CONSTRAINT chk_students_names_not_empty
    CHECK (trim(first_name) <> '' AND trim(last_name) <> '')
);

CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  relationship TEXT,                    -- e.g. 'parent', 'guardian'
  linked_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.parent_link_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  status           public.link_request_status NOT NULL DEFAULT 'pending',
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Only one pending request per parent+student at a time
  UNIQUE (parent_id, student_id, status)
);

-- Indexes
CREATE INDEX idx_students_school_id        ON public.students(school_id);
CREATE INDEX idx_students_class_id         ON public.students(class_id);
CREATE INDEX idx_students_pupil_code       ON public.students(pupil_payment_code);
CREATE INDEX idx_students_active           ON public.students(school_id, is_active);
CREATE INDEX idx_psl_parent_id             ON public.parent_student_links(parent_id);
CREATE INDEX idx_psl_student_id            ON public.parent_student_links(student_id);
CREATE INDEX idx_plr_parent_id             ON public.parent_link_requests(parent_id);
CREATE INDEX idx_plr_status                ON public.parent_link_requests(status);

-- Triggers
CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_psl_updated_at
  BEFORE UPDATE ON public.parent_student_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_plr_updated_at
  BEFORE UPDATE ON public.parent_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_link_requests ENABLE ROW LEVEL SECURITY;
