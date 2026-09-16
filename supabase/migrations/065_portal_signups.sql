-- =============================================================================
-- Migration 065: portal sign-up leads (email-verified "create your portal")
-- =============================================================================
-- Captures a prospective school's email BEFORE they create a portal, and makes
-- them confirm it via a one-time link so we know the address is theirs. The
-- platform owner sees the leads (+ verified status) in /platform. Platform-level
-- (pre-tenant) — no school_id; reads/writes go through the service-role admin
-- client behind the public form / owner-gated /platform, so RLS is enabled with
-- no authenticated policy.
--
-- Email is stored lowercased and UNIQUE, so one lead per address (re-requesting
-- issues a fresh token). `token` is an unguessable one-time secret for the
-- confirmation link; `verified_at` records the confirmation.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

CREATE TABLE public.portal_signups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  school_name  TEXT,
  token        TEXT NOT NULL UNIQUE,
  verified_at  TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portal_signups_requested ON public.portal_signups(requested_at DESC);

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_portal_signups_updated_at
  BEFORE UPDATE ON public.portal_signups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.portal_signups ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_signups TO service_role;
