-- =============================================================================
-- Migration 083: Learning journals / child observations
-- =============================================================================
-- An educator records a dated learning observation ("learning story") for a child,
-- optionally tagged against Ireland's Aistear curriculum themes, with next steps and
-- an optional photo. Parents see the observations shared with them as a timeline in
-- their portal. One row per observation.
--
-- Photos live in a PRIVATE storage bucket `child-observations`; the app reads them
-- through short-lived signed URLs. Writes/reads go through the service-role admin
-- client, scoped manually by school_id/student_id after the role/ownership checks
-- (same pattern as student_assignments, migration 060), so RLS is enabled as
-- defence-in-depth with no authenticated policy.
--
-- Conventions (match 060/078–082): TEXT + CHECK where enumerated, school_id-scoped,
-- set_updated_at trigger, RLS on, explicit grants (this project has NO default
-- privileges — see migrations 019–021).

CREATE TABLE public.child_observations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id           UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  author_profile_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title                TEXT NOT NULL,
  learning_story       TEXT NOT NULL,
  observation_date     DATE NOT NULL,
  -- Subset of Aistear theme keys: well_being, identity_belonging, communicating,
  -- exploring_thinking. Membership is validated in the app layer (array CHECKs are
  -- awkward in Postgres); stored canonical + de-duplicated.
  aistear_themes       TEXT[] NOT NULL DEFAULT '{}',
  next_steps           TEXT,
  image_path           TEXT,
  shared_with_parents  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_child_observations_student
  ON public.child_observations(student_id, observation_date DESC);
CREATE INDEX idx_child_observations_school
  ON public.child_observations(school_id, created_at DESC);

CREATE TRIGGER trg_child_observations_updated_at
  BEFORE UPDATE ON public.child_observations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Private storage bucket ─────────────────────────────────────────────────
-- Not public: objects are served only via server-generated signed URLs. Uploads
-- happen server-side via the service-role client (bypasses storage RLS), so no
-- storage policies are required.
INSERT INTO storage.buckets (id, name, public)
VALUES ('child-observations', 'child-observations', false)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS (defence-in-depth; the service-role client does the work) ─────────────
ALTER TABLE public.child_observations ENABLE ROW LEVEL SECURITY;

-- ─── Grants (no default privileges — see migrations 019–021) ──────────────────
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.child_observations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.child_observations TO service_role;
