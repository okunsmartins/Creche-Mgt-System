-- =============================================================================
-- Migration 104: Late collection fees
-- =============================================================================
-- Per-crèche late-collection policy (cutoff time + fee model) and a log of late
-- collection incidents recorded against a child, each with a snapshotted fee.
--
-- Conventions: school_id-scoped, set_updated_at trigger (003), RLS on, explicit
-- grants. Access is server-side via service_role only (no policies = deny by
-- default for anon/authenticated), matching staff_attendance (100).
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

-- ── Policy (one row per school) ────────────────────────────────────────────────
CREATE TABLE public.late_collection_settings (
  school_id          UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  cutoff_time        TIME NOT NULL DEFAULT '18:00',
  grace_minutes      INTEGER NOT NULL DEFAULT 0 CHECK (grace_minutes >= 0),
  flat_fee_cents     INTEGER NOT NULL DEFAULT 0 CHECK (flat_fee_cents >= 0),
  per_block_fee_cents INTEGER NOT NULL DEFAULT 0 CHECK (per_block_fee_cents >= 0),
  block_minutes      INTEGER NOT NULL DEFAULT 15 CHECK (block_minutes >= 1),
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_late_collection_settings_updated_at
  BEFORE UPDATE ON public.late_collection_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── Incidents ──────────────────────────────────────────────────────────────────
CREATE TABLE public.late_collections (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  collected_at   TIMESTAMPTZ NOT NULL,
  minutes_late   INTEGER NOT NULL CHECK (minutes_late >= 0),
  fee_cents      INTEGER NOT NULL DEFAULT 0 CHECK (fee_cents >= 0),
  note           TEXT,
  parent_alerted BOOLEAN NOT NULL DEFAULT FALSE,
  recorded_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_late_collections_school_time ON public.late_collections(school_id, collected_at DESC);
CREATE INDEX idx_late_collections_student ON public.late_collections(school_id, student_id, collected_at DESC);

CREATE TRIGGER trg_late_collections_updated_at
  BEFORE UPDATE ON public.late_collections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.late_collection_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.late_collections ENABLE ROW LEVEL SECURITY;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.late_collection_settings TO authenticated;
GRANT SELECT ON public.late_collections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.late_collection_settings TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.late_collections TO service_role;

-- ── Audit action ────────────────────────────────────────────────────────────────
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'late_collection.recorded';
