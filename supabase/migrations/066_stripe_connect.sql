-- =============================================================================
-- Migration 066: Stripe Connect (per-school direct-charge accounts)
-- =============================================================================
-- Each school connects its OWN Stripe (Standard) account so parent payments go
-- straight to the school: DIRECT CHARGES, no platform fee. The school is the
-- merchant of record, pays Stripe's fees, and handles its own refunds/disputes.
--
-- These columns track the connected account and whether it can accept charges
-- yet. `charges_enabled` is the gate the app uses before routing a parent payment
-- to the school (a half-onboarded account can't be charged). Kept idempotent.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_details_submitted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_schools_stripe_connect_account_id
  ON public.schools(stripe_connect_account_id);
