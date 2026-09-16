-- =============================================================================
-- Migration 055: SMS-to-parents ("Text parents") — schema
-- =============================================================================
-- Sibling to the email parent-messaging feature. Adds:
--   * profiles.sms_opt_out       — a parent's SMS opt-out (GDPR/ePrivacy STOP)
--   * school_sms_balance         — per-school monthly allowance + purchased credits
--   * sms_messages               — audit of each composed SMS blast (like parent_messages)
--   * sms_notifications          — per-recipient delivery status (like email_notifications)
--
-- Billing model (hybrid): the €44.99 "Pro + SMS" tier includes `included_limit`
-- texts/month (default 100, resets monthly, no rollover); beyond that, sends draw
-- from purchased `credits` (top-ups via Stripe). 1 credit = 1 SMS segment
-- (160 GSM-7 chars). Credits expire 12 months after the latest top-up.
--
-- Status is TEXT + CHECK (self-contained; avoids enum-in-transaction issues).
-- schools/profiles already have service_role grants; new tables get explicit grants.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT FALSE;

-- One balance row per school (created lazily when the school first gets the tier).
CREATE TABLE IF NOT EXISTS public.school_sms_balance (
  school_id          UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  included_limit     INTEGER NOT NULL DEFAULT 100,   -- monthly allowance for the tier
  included_used      INTEGER NOT NULL DEFAULT 0,     -- used this period
  period_start       DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  credits            INTEGER NOT NULL DEFAULT 0,     -- purchased, non-allowance
  credits_expire_at  TIMESTAMPTZ,                    -- refreshed to now()+12mo on each top-up
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_school_sms_balance_updated_at ON public.school_sms_balance;
CREATE TRIGGER trg_school_sms_balance_updated_at
  BEFORE UPDATE ON public.school_sms_balance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Audit of each composed blast.
CREATE TABLE IF NOT EXISTS public.sms_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id       UUID,                              -- profiles.id (nullable to keep audit after deletion)
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('admin', 'teacher')),
  audience_type   TEXT NOT NULL CHECK (audience_type IN ('school', 'class', 'student')),
  class_id        UUID,
  student_id      UUID,
  body            TEXT NOT NULL,
  segments        INTEGER NOT NULL,                  -- segments per message (1 credit each)
  recipient_count INTEGER NOT NULL,
  credits_charged INTEGER NOT NULL,                  -- recipient_count * segments actually charged
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_messages_school_id ON public.sms_messages(school_id, created_at DESC);

-- Per-recipient delivery status (updated by the Twilio status webhook).
CREATE TABLE IF NOT EXISTS public.sms_notifications (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sms_message_id       UUID REFERENCES public.sms_messages(id) ON DELETE SET NULL,
  school_id            UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  recipient_parent_id  UUID,
  recipient_phone      TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'queued'
                       CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'undelivered')),
  provider_message_sid TEXT,
  segments             INTEGER NOT NULL DEFAULT 1,
  failure_details      TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_message ON public.sms_notifications(sms_message_id);
CREATE INDEX IF NOT EXISTS idx_sms_notifications_sid     ON public.sms_notifications(provider_message_sid);

DROP TRIGGER IF EXISTS trg_sms_notifications_updated_at ON public.sms_notifications;
CREATE TRIGGER trg_sms_notifications_updated_at
  BEFORE UPDATE ON public.sms_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS on (writes are all via the service-role client; no anon/authenticated access).
ALTER TABLE public.school_sms_balance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sms_notifications  ENABLE ROW LEVEL SECURITY;

-- This project has NO default privileges — grant service_role explicitly.
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_sms_balance TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_messages       TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sms_notifications  TO service_role;
