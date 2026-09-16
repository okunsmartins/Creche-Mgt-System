-- FR-ACT-002: individual pupil eligibility for activities.
-- Complements activity_class_eligibility — an activity may be eligible for
-- specific classes, specific pupils, or both.

CREATE TABLE IF NOT EXISTS public.activity_pupil_eligibility (
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_id, student_id)
);

ALTER TABLE public.activity_pupil_eligibility ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ape_activity_id ON public.activity_pupil_eligibility (activity_id);
CREATE INDEX IF NOT EXISTS idx_ape_student_id  ON public.activity_pupil_eligibility (student_id);

-- Public read mirrors activity_class_eligibility policy
CREATE POLICY "public_read_pupil_eligibility"
  ON public.activity_pupil_eligibility FOR SELECT USING (TRUE);

-- Admins can manage pupil eligibility
CREATE POLICY "admins_manage_pupil_eligibility"
  ON public.activity_pupil_eligibility FOR ALL
  USING (public.user_has_permission('activities.create'));

-- Table-level SELECT for anon/authenticated (RLS still filters)
GRANT SELECT ON public.activity_pupil_eligibility TO anon, authenticated;
GRANT ALL    ON public.activity_pupil_eligibility TO service_role;
