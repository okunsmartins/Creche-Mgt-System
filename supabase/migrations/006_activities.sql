-- =============================================================================
-- Migration 006: Activities and class eligibility
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.activities (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  -- Amount stored in integer euro cents to avoid floating-point issues
  amount_cents       INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency           TEXT NOT NULL DEFAULT 'EUR',
  accounting_code    TEXT,                         -- optional GL / cost-centre code
  opens_at           TIMESTAMPTZ,                  -- NULL = open immediately when published
  closes_at          TIMESTAMPTZ,                  -- NULL = no closing date
  publication_status public.publication_status NOT NULL DEFAULT 'draft',
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_activities_name_not_empty CHECK (trim(name) <> ''),
  CONSTRAINT chk_activities_dates
    CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at)
);

-- Junction table: which classes are eligible for each activity
CREATE TABLE IF NOT EXISTS public.activity_class_eligibility (
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_id, class_id)
);

-- Indexes
CREATE INDEX idx_activities_school_id          ON public.activities(school_id);
CREATE INDEX idx_activities_publication_status ON public.activities(school_id, publication_status);
CREATE INDEX idx_activities_closes_at          ON public.activities(closes_at);
CREATE INDEX idx_ace_activity_id               ON public.activity_class_eligibility(activity_id);
CREATE INDEX idx_ace_class_id                  ON public.activity_class_eligibility(class_id);

-- Trigger
CREATE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_class_eligibility ENABLE ROW LEVEL SECURITY;
