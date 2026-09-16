-- 057_subscription_sms_addon.sql
-- Phase 5 (SMS): distinguish the €44.99 "Pro + SMS" tier from plain €39.99 Pro.
--
-- The `plan` column is only free/pro/school and is derived from status, so it
-- can't tell the two paid tiers apart. `sms_enabled` is the SMS entitlement: it
-- is set from the subscription's Stripe price at webhook-sync time
-- (STRIPE_PRO_SMS_MONTHLY/ANNUAL_PRICE_ID) and cleared when the subscription is
-- deleted or synced to a non-SMS price. Feature gating reads it together with
-- Pro access (active/trialing/past-due-in-grace).
--
-- Additive + backfilled to false (existing Pro schools are NOT on the SMS tier).

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS sms_enabled BOOLEAN NOT NULL DEFAULT false;
