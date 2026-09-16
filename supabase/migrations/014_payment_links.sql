-- =============================================================================
-- Migration 014: Payment links
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- A payment link is a stable, shareable URL that pre-selects a specific
-- activity and records which admin created it.  The public_token is a
-- cryptographically secure random value; it is NOT the primary key so it
-- can be rotated without breaking foreign-key references.
--
-- Security invariants:
--   • Possession of a link does NOT bypass student validation, price
--     calculation, activity eligibility checks, or Stripe webhook confirmation.
--   • The public_token is the ONLY value exposed in the URL.  The activity_id
--     and internal IDs are NEVER placed in the shareable URL.
--   • use_count is incremented server-side only (never from client input).

CREATE TABLE IF NOT EXISTS public.payment_links (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  activity_id  UUID        NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,
  created_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  label        TEXT        NOT NULL,
  public_token TEXT        NOT NULL UNIQUE
                           DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  expires_at   TIMESTAMPTZ,
  max_uses     INTEGER     CHECK (max_uses IS NULL OR max_uses > 0),
  use_count    INTEGER     NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_links_school_id    ON public.payment_links(school_id);
CREATE INDEX idx_payment_links_activity_id  ON public.payment_links(activity_id);
CREATE INDEX idx_payment_links_public_token ON public.payment_links(public_token);
CREATE INDEX idx_payment_links_active       ON public.payment_links(school_id, is_active);

-- Trigger
CREATE TRIGGER trg_payment_links_updated_at
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_payment_links" ON public.payment_links
  FOR ALL USING (public.is_admin());

-- Anon/authenticated can read an active, non-expired link by public_token
-- (used by the /pay/[token] route to validate and display the activity).
-- The policy exposes no sensitive school data — only the record selected
-- by a specific token the visitor already possesses.
CREATE POLICY "public_read_active_payment_link_by_token" ON public.payment_links
  FOR SELECT USING (
    is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR use_count < max_uses)
  );
