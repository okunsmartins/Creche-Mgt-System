-- =============================================================================
-- Migration 098: Configurable room-ratio bands (per crèche)
-- =============================================================================
-- Each crèche can set its own allowed adult:child ratio for each age band (children
-- per adult). Seeded with the Irish EY reference defaults the first time a crèche saves
-- its configuration; until then the app falls back to the reference set in code. The
-- ratio engine (/admin/ratios, rota cover alerts, the dashboard alert) uses these.
--
-- Conventions: school_id-scoped, set_updated_at trigger (003), RLS on, explicit grants.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.ratio_bands (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  label              TEXT NOT NULL,
  min_months         INTEGER NOT NULL,
  max_months         INTEGER NOT NULL, -- exclusive upper bound
  children_per_adult INTEGER NOT NULL CHECK (children_per_adult >= 1),
  display_order      INTEGER NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ratio_band_months CHECK (max_months > min_months),
  CONSTRAINT chk_ratio_band_label_not_empty CHECK (btrim(label) <> ''),
  UNIQUE (school_id, label)
);

CREATE INDEX idx_ratio_bands_school ON public.ratio_bands(school_id, display_order);

CREATE TRIGGER trg_ratio_bands_updated_at
  BEFORE UPDATE ON public.ratio_bands
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.ratio_bands ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.ratio_bands TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ratio_bands TO service_role;
