-- Add profile_id to teachers so teachers can be linked to their auth account
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_profile_id
  ON public.teachers(profile_id) WHERE profile_id IS NOT NULL;

-- Attendance status enum
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late');

-- One session per class per date
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id     UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id   UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  notes        TEXT,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, class_id, session_date)
);

-- One record per student per session
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id  UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  status     public.attendance_status NOT NULL DEFAULT 'present',
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_att_sessions_school  ON public.attendance_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_att_sessions_class   ON public.attendance_sessions(class_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_att_sessions_teacher ON public.attendance_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_att_records_session  ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_att_records_student  ON public.attendance_records(student_id);

-- Triggers
CREATE TRIGGER trg_attendance_sessions_updated_at
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records  ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "admins_manage_attendance_sessions" ON public.attendance_sessions
  FOR ALL USING (public.is_admin());

CREATE POLICY "admins_manage_attendance_records" ON public.attendance_records
  FOR ALL USING (public.is_admin());

-- Teachers: manage sessions for their own assigned class
CREATE POLICY "teachers_manage_own_sessions" ON public.attendance_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      JOIN public.classes c ON c.teacher_id = t.id
      WHERE t.profile_id = auth.uid()
        AND c.id = attendance_sessions.class_id
        AND t.is_active = TRUE
    )
  );

-- Teachers: manage records in sessions for their class
CREATE POLICY "teachers_manage_own_records" ON public.attendance_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      JOIN public.classes c ON c.id = s.class_id
      JOIN public.teachers t ON t.id = c.teacher_id
      WHERE t.profile_id = auth.uid()
        AND s.id = attendance_records.session_id
        AND t.is_active = TRUE
    )
  );

-- ─── Service-role grants ──────────────────────────────────────────────────────
-- This project has no default privileges configured (see migrations 019–021),
-- so service_role needs explicit grants on every new table. Admin server
-- actions use createSupabaseAdminClient() (service role); without these grants
-- they fail with PostgreSQL error 42501 (permission denied).

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.attendance_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.attendance_records TO service_role;
