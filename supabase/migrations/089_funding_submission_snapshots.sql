-- =============================================================================
-- Migration 089: Funding & Hive Centre — immutable submission snapshots / evidence
-- =============================================================================
-- Additive. funding_submission_snapshots freezes exactly what a prepared funding
-- return looked like at the moment it was readied for Hive: a canonical JSON payload +
-- the rules version + who prepared it, and later the external-submission evidence. The
-- PAYLOAD is immutable (no updated_at trigger; a correction is a NEW snapshot that
-- SUPERSEDES the old one). Only the one-way status/submission-evidence fields are set
-- after creation, via the app's controlled transitions.
--
-- Conventions (match 084–088): TEXT + CHECK enums, school_id-scoped, RLS on, explicit
-- grants (no default privileges). ⚠️ Apply to the REAL production project
-- (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.funding_submission_snapshots (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id             UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  -- What was captured; extensible (claims/ECCE batches later).
  kind                  TEXT NOT NULL CHECK (kind IN ('NCS_WEEKLY_RETURN')),
  -- The thing it is for, e.g. the reporting week start (YYYY-MM-DD) for a weekly return.
  reference             TEXT NOT NULL,
  -- Canonical, immutable frozen data (see lib/funding/submissions.ts).
  payload               JSONB NOT NULL,
  rules_version         TEXT,
  item_count            INTEGER NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'PREPARED'
                          CHECK (status IN ('PREPARED', 'SUBMITTED_EXTERNALLY', 'SUPERSEDED')),
  prepared_by           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  prepared_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- External submission evidence (Hive remains the official portal).
  submitted_by          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  submitted_at          TIMESTAMPTZ,
  submission_reference  TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_submission_scope
  ON public.funding_submission_snapshots(school_id, kind, created_at DESC);

-- At most one live PREPARED snapshot per (tenant, kind, reference); re-preparing
-- supersedes the old one first (enforced by the app, backstopped here).
CREATE UNIQUE INDEX uq_submission_prepared_live
  ON public.funding_submission_snapshots(school_id, kind, reference)
  WHERE status = 'PREPARED';

ALTER TABLE public.funding_submission_snapshots ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.funding_submission_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_submission_snapshots TO service_role;
