-- =============================================================================
-- Migration 052: track the Revolut order id on payments
-- =============================================================================
-- Revolut's Merchant API identifies a payment by its order id (returned when we
-- create the order, echoed back on the webhook). We store it so the webhook can
-- look up the local payment and enforce idempotency/amount checks. Stripe rows
-- leave this NULL (they use provider_checkout_session_id / payment_intent_id).
--
-- Grants already cover public.payments (migration 020) — no new grants needed.
--
-- ⚠️ Apply to the REAL production project: jywkpenzhzzptsrntobf
--    ("PrimarySchoolPortal"). Run after 051.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS provider_order_id TEXT;

-- Partial unique index: fast webhook lookup by Revolut order id, and a guard
-- against two payments claiming the same provider order. NULLs (Stripe rows)
-- are excluded, so it never collides with existing data.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_provider_order_id
  ON public.payments (provider_order_id)
  WHERE provider_order_id IS NOT NULL;
