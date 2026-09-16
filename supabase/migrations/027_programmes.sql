-- =============================================================================
-- Migration 027: Programmes
-- =============================================================================
-- Programmes are recurring weekly sessions (e.g. choir, football, coding club)
-- with a pricing model (per term / month / session), specific days, and term dates.

CREATE TABLE IF NOT EXISTS public.programmes (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID          NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name             TEXT          NOT NULL,
  description      TEXT,
  price_cents      INTEGER       NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency         TEXT          NOT NULL DEFAULT 'EUR',
  pricing_model    TEXT          NOT NULL DEFAULT 'per_term'
                                 CHECK (pricing_model IN ('per_term', 'per_month', 'per_session')),
  days_of_week     TEXT[]        NOT NULL DEFAULT '{}',
  session_time     TIME,
  term_start       DATE,
  term_end         DATE,
  max_enrolments   INTEGER       CHECK (max_enrolments IS NULL OR max_enrolments > 0),
  publication_status public.publication_status NOT NULL DEFAULT 'draft',
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by       UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_programmes_name_not_empty CHECK (trim(name) <> ''),
  CONSTRAINT chk_programmes_term_dates     CHECK (
    term_end IS NULL OR term_start IS NULL OR term_end > term_start
  )
);

CREATE TABLE IF NOT EXISTS public.programme_class_eligibility (
  programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  class_id     UUID NOT NULL REFERENCES public.classes(id)    ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (programme_id, class_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_programmes_school_id
  ON public.programmes(school_id);

CREATE INDEX IF NOT EXISTS idx_programmes_publication_status
  ON public.programmes(publication_status);

CREATE INDEX IF NOT EXISTS idx_programme_class_eligibility_programme_id
  ON public.programme_class_eligibility(programme_id);

CREATE INDEX IF NOT EXISTS idx_programme_class_eligibility_class_id
  ON public.programme_class_eligibility(class_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE TRIGGER trg_programmes_updated_at
  BEFORE UPDATE ON public.programmes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_class_eligibility ENABLE ROW LEVEL SECURITY;

-- Authenticated parents/teachers can read published programmes for their school.
-- Admin client (service role) bypasses RLS for all CRUD operations.

CREATE POLICY "authenticated_read_published_programmes"
  ON public.programmes
  FOR SELECT TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND publication_status = 'published'
    AND is_active = TRUE
  );

CREATE POLICY "authenticated_read_programme_class_eligibility"
  ON public.programme_class_eligibility
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programmes p
      WHERE p.id = programme_id
        AND p.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ─── Service-role grants ──────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.programmes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.programme_class_eligibility TO service_role;
