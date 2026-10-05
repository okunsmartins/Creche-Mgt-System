-- =============================================================================
-- Migration 087: Funding & Hive Centre — Phase 4 (Core Funding shadow profile)
-- =============================================================================
-- Additive. Stores the last VERIFIED Core Funding profile snapshot per tenant +
-- programme year. The current candidate profile is derived from live operational
-- data (rooms/staff/capacity/weeks) at read time and compared to the latest snapshot
-- to surface drift; drift actions reuse hive_action_items (no new events table).
-- Snapshots are immutable (no updated_at trigger) — a new Review & Confirm captures a
-- new row.
--
-- Conventions: school_id-scoped, RLS on, explicit grants (no default privileges).
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.core_funding_snapshots (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id      UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  programme_year TEXT NOT NULL,
  -- The funding-relevant profile at capture time: staffCount, roomCount,
  -- totalCapacity, operatingWeeks (see lib/funding/core-funding.ts).
  profile        JSONB NOT NULL,
  captured_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_core_snapshot_scope
  ON public.core_funding_snapshots(school_id, programme_year, created_at DESC);

ALTER TABLE public.core_funding_snapshots ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.core_funding_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.core_funding_snapshots TO service_role;
