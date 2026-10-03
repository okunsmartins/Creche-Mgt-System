-- =============================================================================
-- Migration 082: raise the included SMS allowance to 500/month
-- =============================================================================
-- Pricing change: Creche Wise moves to a single all-inclusive plan. SMS is now
-- included with the plan (no separate "Pro + SMS" tier), with a generous monthly
-- allowance of 500 texts (was 100) plus the existing paid top-up credits beyond it.
--
-- Updates the column default for new schools and lifts existing rows still on the
-- old 100 allowance. Rows a crèche has deliberately been set higher are untouched.

ALTER TABLE public.school_sms_balance
  ALTER COLUMN included_limit SET DEFAULT 500;

UPDATE public.school_sms_balance
  SET included_limit = 500
  WHERE included_limit = 100;
