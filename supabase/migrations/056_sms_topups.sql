-- =============================================================================
-- Migration 056: SMS credit top-up ledger
-- =============================================================================
-- Records each purchased SMS credit bundle (Stripe one-off checkout). The
-- UNIQUE(provider_session_id) makes crediting idempotent — the webhook can retry
-- without double-adding credits (credit-add is additive, so it needs an explicit
-- idempotency key, unlike the monotonic order state machine). Also serves as the
-- school's top-up purchase history.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

CREATE TABLE IF NOT EXISTS public.sms_topups (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  provider_session_id  TEXT NOT NULL UNIQUE,   -- Stripe checkout session id (idempotency key)
  credits              INTEGER NOT NULL,
  amount_cents         INTEGER NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_topups_school_id ON public.sms_topups(school_id, created_at DESC);

ALTER TABLE public.sms_topups ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_topups TO service_role;
