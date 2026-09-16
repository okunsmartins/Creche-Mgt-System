-- =============================================================================
-- Migration 060: Student assignment uploads
-- =============================================================================
-- A place for a parent to upload their linked child's work — a photo of a
-- handwritten assignment (the camera yields a JPEG) or a PDF. One row per file.
--
-- Files live in a PRIVATE storage bucket `student-assignments`; the app reads
-- them through short-lived signed URLs (student work is not public). Uploads and
-- reads go through the service-role admin client, scoped manually by
-- student_id/school_id after verifying the parent↔child link (same pattern as
-- the rest of the parent portal), so RLS is enabled as defence-in-depth with no
-- authenticated policy.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

CREATE TABLE public.student_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  uploaded_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title             TEXT,
  file_path         TEXT NOT NULL,
  file_kind         TEXT NOT NULL CHECK (file_kind IN ('image', 'pdf')),
  content_type      TEXT NOT NULL,
  file_size_bytes   INTEGER NOT NULL,
  original_filename TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_assignments_student ON public.student_assignments(student_id, created_at DESC);
CREATE INDEX idx_student_assignments_school  ON public.student_assignments(school_id, created_at DESC);

-- ─── Private storage bucket ─────────────────────────────────────────────────
-- Not public: objects are served only via server-generated signed URLs. Uploads
-- happen server-side via the service-role client (bypasses storage RLS), so no
-- storage policies are required.
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-assignments', 'student-assignments', false)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_assignments ENABLE ROW LEVEL SECURITY;

-- Writes + reads are performed by the service-role admin client (server actions +
-- pages scoped manually by student_id/school_id). RLS-on with no policy denies
-- direct anon/authenticated access.

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.student_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_assignments TO service_role;
