-- =============================================================================
-- Migration 063: staff-uploaded student documents (test results, report cards)
-- =============================================================================
-- School staff upload a finished document for a pupil — a test result or an
-- end-of-term report card (PDF or image) — which the pupil's linked parents can
-- view. Staff→parent direction (the mirror of student_assignments). One row per
-- file. `category` distinguishes the kind; `term` is an optional free-text label
-- (e.g. "Term 1 2025/26") used mainly for report cards.
--
-- Files live in a PRIVATE storage bucket `student-documents`; the app reads them
-- through short-lived signed URLs. Uploads/reads go through the service-role
-- admin client, scoped after verifying the uploader (teacher of the pupil's
-- class, or a school admin) — so RLS is enabled with no authenticated policy.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

CREATE TABLE public.student_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  uploaded_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category          TEXT NOT NULL CHECK (category IN ('test_result', 'report_card')),
  title             TEXT,
  term              TEXT,
  file_path         TEXT NOT NULL,
  file_kind         TEXT NOT NULL CHECK (file_kind IN ('image', 'pdf')),
  content_type      TEXT NOT NULL,
  file_size_bytes   INTEGER NOT NULL,
  original_filename TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_documents_student  ON public.student_documents(student_id, category, created_at DESC);
CREATE INDEX idx_student_documents_school   ON public.student_documents(school_id, category, created_at DESC);

-- ─── Private storage bucket ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.student_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_documents TO service_role;
