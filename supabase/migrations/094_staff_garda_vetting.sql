-- =============================================================================
-- Migration 094: Garda vetting records (Phase 5 of the staff workforce module)
-- =============================================================================
-- One current Garda (National Vetting Bureau) vetting record per staff member. There is
-- no statutory expiry, but crèches run a renewal cycle, so each record carries a renewal
-- (expiry) date that drives the renewal alerts on /admin/vetting.
--
-- Separate table (not teacher columns) so staff pages keep working if this is unapplied.
-- One record per teacher: unique on (school_id, teacher_id); the vetting UI upserts it.
--
-- Conventions: school_id-scoped, set_updated_at trigger (003), RLS on, explicit grants
-- (no default privileges).
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.garda_vetting (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  -- Vetting disclosure / application reference from the NVB (free text, optional).
  reference    TEXT,
  -- Date the disclosure was issued (optional).
  vetting_date DATE,
  -- Renewal / expiry date that drives the alerts (optional).
  expiry_date  DATE,
  notes        TEXT,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One current vetting record per staff member (the UI upserts on this).
CREATE UNIQUE INDEX uq_garda_vetting_teacher
  ON public.garda_vetting(school_id, teacher_id);
CREATE INDEX idx_garda_vetting_expiry
  ON public.garda_vetting(school_id, expiry_date);

CREATE TRIGGER trg_garda_vetting_updated_at
  BEFORE UPDATE ON public.garda_vetting
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.garda_vetting ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.garda_vetting TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.garda_vetting TO service_role;
