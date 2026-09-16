-- =============================================================================
-- Migration 067: Per-school Revolut credentials (encrypted at rest)
-- =============================================================================
-- Lets each school connect its OWN Revolut Merchant account so Revolut parent
-- payments go straight to the school (mirrors the Stripe Connect model). The
-- Merchant API key and the webhook signing secret are stored ENCRYPTED
-- (AES-256-GCM via the app's ENCRYPTION_KEY env — never plaintext). Both nullable
-- until a school configures Revolut; when null the platform-level key is used.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS revolut_api_key_enc TEXT,
  ADD COLUMN IF NOT EXISTS revolut_webhook_secret_enc TEXT;
