-- =============================================================================
-- Migration 079: School Collection Service (Feature A) — Slice 1: configuration
-- =============================================================================
-- Design: docs/design/school-collection-and-authorised-collectors.md
-- A crèche defines the collection methods it offers (dropdown config) and the
-- school "runs" it operates (which primary school, which days, by what method,
-- capacity + chaperone ratio, and the charge basis + price). Enrolment, consent
-- and charging come in a later slice (migration 080).
--
-- Conventions (match 070–078): TEXT + CHECK enum, school_id-scoped, set_updated_at
-- trigger, RLS on as defence-in-depth, explicit grants (no default privileges).

-- ── Per-crèche collection methods (the configurable dropdown source) ──────────
CREATE TABLE public.collection_methods (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  label          TEXT NOT NULL,
  has_transport  BOOLEAN NOT NULL DEFAULT FALSE,
  display_order  INTEGER NOT NULL DEFAULT 0,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_method_label CHECK (trim(label) <> '')
);
CREATE INDEX idx_collection_methods_scope ON public.collection_methods(school_id, display_order);

-- ── Collection runs (a school run / route) ────────────────────────────────────
CREATE TABLE public.collection_runs (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id              UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  origin_school_name     TEXT NOT NULL,
  collection_method_id   UUID REFERENCES public.collection_methods(id) ON DELETE SET NULL,
  days_of_week           SMALLINT[] NOT NULL DEFAULT '{}',   -- ISO: 1=Mon … 7=Sun
  pickup_time            TIME,
  capacity               INTEGER NOT NULL DEFAULT 1,
  children_per_chaperone INTEGER NOT NULL DEFAULT 4,          -- ratio, CONFIRM vs Tusla
  charge_basis           TEXT NOT NULL DEFAULT 'per_day'
                           CHECK (charge_basis IN ('per_day','weekly','per_term')),
  price_cents            INTEGER NOT NULL DEFAULT 0,
  is_active              BOOLEAN NOT NULL DEFAULT TRUE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_run_name CHECK (trim(name) <> ''),
  CONSTRAINT chk_run_origin CHECK (trim(origin_school_name) <> ''),
  CONSTRAINT chk_run_capacity CHECK (capacity >= 1),
  CONSTRAINT chk_run_ratio CHECK (children_per_chaperone >= 1),
  CONSTRAINT chk_run_price CHECK (price_cents >= 0)
);
CREATE INDEX idx_collection_runs_scope ON public.collection_runs(school_id, is_active);

-- ── Staff assigned to a run (for the chaperone ratio) ─────────────────────────
CREATE TABLE public.collection_run_staff (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  collection_run_id    UUID NOT NULL REFERENCES public.collection_runs(id) ON DELETE CASCADE,
  teacher_id           UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_run_staff UNIQUE (collection_run_id, teacher_id)
);
CREATE INDEX idx_collection_run_staff_run ON public.collection_run_staff(collection_run_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────
CREATE TRIGGER trg_collection_methods_updated_at
  BEFORE UPDATE ON public.collection_methods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_collection_runs_updated_at
  BEFORE UPDATE ON public.collection_runs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS (defence-in-depth; the service-role client does the work) ─────────────
ALTER TABLE public.collection_methods   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_run_staff ENABLE ROW LEVEL SECURITY;

-- ── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.collection_methods   TO authenticated;
GRANT SELECT ON public.collection_runs      TO authenticated;
GRANT SELECT ON public.collection_run_staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_methods   TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_runs      TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_run_staff TO service_role;
