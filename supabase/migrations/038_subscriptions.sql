-- =============================================================================
-- Migration 038: Subscriptions (SaaS billing) — Phase 1 of the subscription plan
-- =============================================================================
-- Per-school subscription, one row per school. Source of truth for plan + status;
-- kept in sync by Stripe webhooks (Phase 3). Hybrid gating model (agreed):
--   * Portals are free to create with core features.
--   * A trial-or-subscribe requirement applies after a grace window (status =
--     trialing → past_due → cancelled drives the lock).
--   * Pro tiers unlock premium features on top.
--
-- Writes are performed by the service-role client (server actions + webhooks),
-- which bypasses RLS. `authenticated` only needs SELECT so an admin can view
-- their own school's plan — without the grant, RLS is never reached (42501).

-- ─── Enums ────────────────────────────────────────────────────────────────────
CREATE TYPE public.subscription_plan   AS ENUM ('free', 'pro', 'school');
CREATE TYPE public.subscription_status AS ENUM ('active', 'trialing', 'past_due', 'cancelled', 'incomplete');

-- ─── Table ────────────────────────────────────────────────────────────────────
CREATE TABLE public.subscriptions (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id              UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  stripe_customer_id     TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan                   public.subscription_plan   NOT NULL DEFAULT 'free',
  status                 public.subscription_status NOT NULL DEFAULT 'active',
  current_period_end     TIMESTAMPTZ,
  cancel_at_period_end   BOOLEAN NOT NULL DEFAULT FALSE,
  trial_ends_at          TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One subscription per school (the per-tenant source of truth).
  UNIQUE (school_id)
);

CREATE INDEX idx_subscriptions_school_id          ON public.subscriptions(school_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.subscriptions TO authenticated;

-- Admins may read only their own school's subscription. Uses the school-scoped
-- helper from migration 034 (SECURITY DEFINER over user_roles). Writes are
-- service-role only, so no INSERT/UPDATE/DELETE policy is granted to anon/auth.
CREATE POLICY "admins_read_own_subscription" ON public.subscriptions
  FOR SELECT USING (public.is_admin_of_school(school_id));
