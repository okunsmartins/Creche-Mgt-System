-- REMAINDER CHUNK 3_052-061 — run this whole file as ONE query, then run the next chunk.
-- Contains migrations: 052_payments_provider_order_id.sql, 053_school_logo.sql, 054_school_subdomain_provisioned.sql, 055_sms_messaging.sql, 056_sms_topups.sql, 057_subscription_sms_addon.sql, 059_drop_subdomain_provisioned.sql, 060_student_assignments.sql, 061_assignment_uploaded_email_type.sql

-- ============================================================
-- 052_payments_provider_order_id.sql
-- ============================================================
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

-- ============================================================
-- 053_school_logo.sql
-- ============================================================
-- =============================================================================
-- Migration 053: school logo (column + public storage bucket)
-- =============================================================================
-- Adds per-tenant logo support:
--   1. schools.logo_url — public URL of the uploaded crest (NULL = use initials).
--   2. A PUBLIC storage bucket `school-logos` for the image files.
--
-- Uploads happen server-side via the service-role client (see
-- src/lib/schools/actions.ts), which bypasses storage RLS, so no write policies
-- are required. The bucket is public, so the logo is readable via its public URL
-- with no read policy. schools already has GRANT ALL to service_role (migration
-- 019), so the new column needs no additional grants.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS logo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 054_school_subdomain_provisioned.sql
-- ============================================================
-- =============================================================================
-- Migration 054: track whether a school's subdomain is actually live in DNS
-- =============================================================================
-- `schools.subdomain` may be set even when the matching DNS record / Vercel
-- domain was never provisioned (older schools created before auto-provisioning,
-- or a provisioning failure). This flag records whether `<subdomain>.<root>` is
-- actually reachable, so branded PUBLIC urls (pay-by-link) only use the
-- subdomain when it resolves — otherwise they fall back to the apex app URL and
-- a shared payment link never points at a dead host.
--
-- Set TRUE automatically by provisionSchool after a successful auto-provision
-- (see src/lib/tenant/provision.ts + domainProvision.ts). Backfills the two
-- subdomains that are already live in DNS (stmarys = manual, stpaul = auto).
--
-- schools already has GRANT ALL to service_role (migration 019), so no new
-- grants are needed.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS subdomain_provisioned BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE public.schools
  SET subdomain_provisioned = TRUE
  WHERE subdomain IN ('stmarys', 'stpaul');

-- ============================================================
-- 055_sms_messaging.sql
-- ============================================================
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

-- ============================================================
-- 056_sms_topups.sql
-- ============================================================
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

-- ============================================================
-- 057_subscription_sms_addon.sql
-- ============================================================
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

-- ============================================================
-- 059_drop_subdomain_provisioned.sql
-- ============================================================
-- 059_drop_subdomain_provisioned.sql
-- Single-domain (Aladdin-style) tenancy: per-school subdomain provisioning was
-- removed. The `subdomain_provisioned` flag is no longer read or written by any
-- code, so drop it.
--
-- ⚠️ Apply AFTER the code that removed the column's readers is deployed
-- (this migration's PR), so there's no window where old code selects a
-- now-missing column. Idempotent.
--
-- The `subdomain` column is kept: host-based resolution (existing
-- <sub>.<root> links) still works via getTenantSubdomain.

ALTER TABLE public.schools
  DROP COLUMN IF EXISTS subdomain_provisioned;

-- ============================================================
-- 060_student_assignments.sql
-- ============================================================
-- =============================================================================
-- Migration 060: Student assignment uploads
-- =============================================================================
-- A place for a parent to upload their linked child's work — a photo of a
-- handwritten assignment (the camera yields a JPEG) or a PDF. One row per file.
--
-- Files live in a PRIVATE storage bucket `student-assignments`; the app reads
-- them through short-lived signed URLs (student work is not public). Uploads and
-- reads go through the service-role admin client, scoped manually by
-- student_id/school_id after verifying the parent↔child link (same pattern as
-- the rest of the parent portal), so RLS is enabled as defence-in-depth with no
-- authenticated policy.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

CREATE TABLE public.student_assignments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  uploaded_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title             TEXT,
  file_path         TEXT NOT NULL,
  file_kind         TEXT NOT NULL CHECK (file_kind IN ('image', 'pdf')),
  content_type      TEXT NOT NULL,
  file_size_bytes   INTEGER NOT NULL,
  original_filename TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_assignments_student ON public.student_assignments(student_id, created_at DESC);
CREATE INDEX idx_student_assignments_school  ON public.student_assignments(school_id, created_at DESC);

-- ─── Private storage bucket ─────────────────────────────────────────────────
-- Not public: objects are served only via server-generated signed URLs. Uploads
-- happen server-side via the service-role client (bypasses storage RLS), so no
-- storage policies are required.
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-assignments', 'student-assignments', false)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_assignments ENABLE ROW LEVEL SECURITY;

-- Writes + reads are performed by the service-role admin client (server actions +
-- pages scoped manually by student_id/school_id). RLS-on with no policy denies
-- direct anon/authenticated access.

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.student_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_assignments TO service_role;

-- ============================================================
-- 061_assignment_uploaded_email_type.sql
-- ============================================================
-- =============================================================================
-- Migration 061: email_type value for assignment-upload notifications
-- =============================================================================
-- Adds the email_type value used when notifying a class teacher that a parent
-- uploaded a new assignment for one of their pupils. Enum-only migration (no
-- table DDL) — ALTER TYPE ... ADD VALUE must commit before the value can be
-- referenced, and the app uses it at runtime, so it is isolated here.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'assignment_uploaded';
