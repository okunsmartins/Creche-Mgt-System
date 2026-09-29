-- REMAINDER CHUNK 4_062-070 — run this whole file as ONE query, then run the next chunk.
-- Contains migrations: 062_attendance_parent_reason.sql, 063_student_documents.sql, 064_permission_slips.sql, 065_portal_signups.sql, 066_stripe_connect.sql, 067_revolut_per_school.sql, 068_funding_config.sql, 069_onboarding_settings.sql, 070_custom_fields.sql

-- ============================================================
-- 062_attendance_parent_reason.sql
-- ============================================================
-- =============================================================================
-- Migration 062: parent-entered absence/late reasons
-- =============================================================================
-- Lets a parent record a reason for a day their child was marked absent or late,
-- on the existing per-(session, student) attendance record. Separate from the
-- teacher's `note` so the two never overwrite each other. Written server-side via
-- the service-role client after verifying the parent↔child link, so no new RLS
-- policy is required; the columns inherit the table's existing grants (migration
-- 032).
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS parent_reason    TEXT,
  ADD COLUMN IF NOT EXISTS parent_reason_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_reason_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================
-- 063_student_documents.sql
-- ============================================================
-- =============================================================================
-- Migration 063: staff-uploaded student documents (test results, report cards)
-- =============================================================================
-- School staff upload a finished document for a pupil — a test result or an
-- end-of-term report card (PDF or image) — which the pupil's linked parents can
-- view. Staff→parent direction (the mirror of student_assignments). One row per
-- file. `category` distinguishes the kind; `term` is an optional free-text label
-- (e.g. "Term 1 2025/26") used mainly for report cards.
--
-- Files live in a PRIVATE storage bucket `student-documents`; the app reads them
-- through short-lived signed URLs. Uploads/reads go through the service-role
-- admin client, scoped after verifying the uploader (teacher of the pupil's
-- class, or a school admin) — so RLS is enabled with no authenticated policy.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

CREATE TABLE public.student_documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id        UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  uploaded_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  category          TEXT NOT NULL CHECK (category IN ('test_result', 'report_card')),
  title             TEXT,
  term              TEXT,
  file_path         TEXT NOT NULL,
  file_kind         TEXT NOT NULL CHECK (file_kind IN ('image', 'pdf')),
  content_type      TEXT NOT NULL,
  file_size_bytes   INTEGER NOT NULL,
  original_filename TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_student_documents_student  ON public.student_documents(student_id, category, created_at DESC);
CREATE INDEX idx_student_documents_school   ON public.student_documents(school_id, category, created_at DESC);

-- ─── Private storage bucket ─────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-documents', 'student-documents', false)
ON CONFLICT (id) DO NOTHING;

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.student_documents ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.student_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_documents TO service_role;

-- ============================================================
-- 064_permission_slips.sql
-- ============================================================
-- =============================================================================
-- Migration 064: online permission slips
-- =============================================================================
-- Staff create a permission slip (title, description, optional due date) targeted
-- at a class or the whole school; a parent grants or declines consent per child,
-- with an optional note. One consent row per (slip, student) — any linked parent
-- can set/update it (last write wins, like the absence reason).
--
-- Reads/writes go through the service-role admin client, scoped after verifying
-- the actor (staff create authz / parent↔child link), so RLS is enabled with no
-- authenticated policy.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

CREATE TABLE public.permission_slips (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by_role TEXT NOT NULL CHECK (created_by_role IN ('admin', 'teacher')),
  title           TEXT NOT NULL,
  description     TEXT,
  due_date        DATE,
  audience_type   TEXT NOT NULL CHECK (audience_type IN ('class', 'school')),
  class_id        UUID REFERENCES public.classes(id) ON DELETE CASCADE,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT permission_slip_class_required CHECK (audience_type <> 'class' OR class_id IS NOT NULL)
);

CREATE INDEX idx_permission_slips_school ON public.permission_slips(school_id, created_at DESC);
CREATE INDEX idx_permission_slips_class  ON public.permission_slips(class_id);

CREATE TABLE public.permission_slip_responses (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slip_id      UUID NOT NULL REFERENCES public.permission_slips(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  parent_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  consent      BOOLEAN NOT NULL,
  note         TEXT,
  responded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slip_id, student_id)
);

CREATE INDEX idx_slip_responses_slip    ON public.permission_slip_responses(slip_id);
CREATE INDEX idx_slip_responses_student ON public.permission_slip_responses(student_id);

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_permission_slips_updated_at
  BEFORE UPDATE ON public.permission_slips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_slip_responses_updated_at
  BEFORE UPDATE ON public.permission_slip_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.permission_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permission_slip_responses ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.permission_slips TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_slips TO service_role;
GRANT SELECT ON public.permission_slip_responses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permission_slip_responses TO service_role;

-- ============================================================
-- 065_portal_signups.sql
-- ============================================================
-- =============================================================================
-- Migration 065: portal sign-up leads (email-verified "create your portal")
-- =============================================================================
-- Captures a prospective school's email BEFORE they create a portal, and makes
-- them confirm it via a one-time link so we know the address is theirs. The
-- platform owner sees the leads (+ verified status) in /platform. Platform-level
-- (pre-tenant) — no school_id; reads/writes go through the service-role admin
-- client behind the public form / owner-gated /platform, so RLS is enabled with
-- no authenticated policy.
--
-- Email is stored lowercased and UNIQUE, so one lead per address (re-requesting
-- issues a fresh token). `token` is an unguessable one-time secret for the
-- confirmation link; `verified_at` records the confirmation.
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

CREATE TABLE public.portal_signups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email        TEXT NOT NULL UNIQUE,
  contact_name TEXT,
  school_name  TEXT,
  token        TEXT NOT NULL UNIQUE,
  verified_at  TIMESTAMPTZ,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_portal_signups_requested ON public.portal_signups(requested_at DESC);

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_portal_signups_updated_at
  BEFORE UPDATE ON public.portal_signups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.portal_signups ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portal_signups TO service_role;

-- ============================================================
-- 066_stripe_connect.sql
-- ============================================================
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

-- ============================================================
-- 067_revolut_per_school.sql
-- ============================================================
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

-- ============================================================
-- 068_funding_config.sql
-- ============================================================
-- =============================================================================
-- Migration 068: Funding scheme config (ECCE/NCS) + per-tenant funding settings
-- =============================================================================
-- FEE-03. Two tables:
--   * funding_scheme_versions — NATIONAL, effective-dated reference rates (ECCE
--     capitation, NCS universal rate + caps). Platform-seeded; the subvention
--     engine (FEE-05) reads the version applicable to a billing date. NOT
--     tenant-scoped. Status/scheme use TEXT + CHECK (no ALTER TYPE gotcha).
--   * tenant_funding_settings — per-school toggles + the billing model (ADR-002).
-- Reads go through the service-role admin client; RLS is enabled as
-- defence-in-depth (no authenticated policy), matching migration 046.
--
-- Seeded rates are 2025/26 REFERENCE values and MUST be confirmed against the
-- current Pobal circular before go-live (see docs/design/fee-subvention-engine.md §7).

-- ─── funding_scheme_versions (national, effective-dated) ─────────────────────
CREATE TABLE public.funding_scheme_versions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme         TEXT NOT NULL CHECK (scheme IN ('ECCE', 'NCS_UNIVERSAL')),
  effective_from DATE NOT NULL,
  effective_to   DATE,                    -- NULL = open-ended current version
  params         JSONB NOT NULL,
  source_ref     TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  CONSTRAINT funding_version_dates_ordered
    CHECK (effective_to IS NULL OR effective_to > effective_from),
  -- Prevent duplicate start dates per scheme. Full non-overlap is an app/seed
  -- invariant; resolveSchemeVersion() picks the latest start on/at a date.
  CONSTRAINT funding_version_scheme_from_unique UNIQUE (scheme, effective_from)
);

CREATE INDEX idx_funding_versions_scheme
  ON public.funding_scheme_versions(scheme, effective_from DESC);

-- ─── tenant_funding_settings (per-school) ────────────────────────────────────
CREATE TABLE public.tenant_funding_settings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                 UUID NOT NULL UNIQUE REFERENCES public.schools(id) ON DELETE CASCADE,
  ecce_enabled              BOOLEAN NOT NULL DEFAULT TRUE,
  ncs_enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  higher_capitation_default BOOLEAN NOT NULL DEFAULT FALSE,
  subvention_billing_model  TEXT NOT NULL DEFAULT 'BILL_ON_CONTRACTED'
    CHECK (subvention_billing_model IN ('BILL_ON_CONTRACTED', 'RECONCILE_ON_ATTENDANCE')),
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_tenant_funding_settings_updated_at
  BEFORE UPDATE ON public.tenant_funding_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS (defence-in-depth; service-role client does the work) ────────────────
ALTER TABLE public.funding_scheme_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_funding_settings ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.funding_scheme_versions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_scheme_versions TO service_role;
GRANT SELECT ON public.tenant_funding_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_funding_settings TO service_role;

-- ─── Seed: 2025/26 REFERENCE rates — CONFIRM against the Pobal circular ───────
INSERT INTO public.funding_scheme_versions (scheme, effective_from, effective_to, params, source_ref)
VALUES
  ('ECCE', DATE '2025-09-01', NULL,
   '{"capitation_standard_weekly_cents":6900,"capitation_higher_weekly_cents":8025,"max_hours_per_day":3,"max_hours_per_week":15,"weeks_per_year":38}'::jsonb,
   'REFERENCE 2025/26 — CONFIRM with Pobal circular'),
  ('NCS_UNIVERSAL', DATE '2025-09-01', NULL,
   '{"hourly_rate_cents":214,"max_hours_working":45,"max_hours_not_working":20,"min_age_weeks":24,"max_age_years":15,"income_assessed_max_hourly_rate_cents":510}'::jsonb,
   'REFERENCE 2025/26 — CONFIRM with Pobal circular');

-- ============================================================
-- 069_onboarding_settings.sql
-- ============================================================
-- =============================================================================
-- Migration 069: Onboarding config toggles (the "both ways" questions)
-- =============================================================================
-- CFG-01. Extends tenant_funding_settings (mig 068) with the finite per-tenant
-- choices a manager makes so onboarding + the fee engine can work "both ways":
--   * fee_model        — one flat fee per child, or fees that vary by session type
--   * gross_fee_basis  — whether a recorded fee is before or after NCS/ECCE subsidy
--   * deposits_enabled — whether the tenant tracks deposits / registration fees
-- All TEXT + CHECK / BOOLEAN with safe defaults so existing tenants keep the
-- standard behaviour. No new grants needed (columns on an already-granted table).

ALTER TABLE public.tenant_funding_settings
  ADD COLUMN IF NOT EXISTS fee_model TEXT NOT NULL DEFAULT 'FLAT_PER_CHILD'
    CONSTRAINT tenant_funding_fee_model_values
    CHECK (fee_model IN ('FLAT_PER_CHILD', 'PER_SESSION_TYPE')),
  ADD COLUMN IF NOT EXISTS gross_fee_basis TEXT NOT NULL DEFAULT 'BEFORE_SUBSIDY'
    CONSTRAINT tenant_funding_gross_basis_values
    CHECK (gross_fee_basis IN ('BEFORE_SUBSIDY', 'AFTER_SUBSIDY')),
  ADD COLUMN IF NOT EXISTS deposits_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 070_custom_fields.sql
-- ============================================================
-- =============================================================================
-- Migration 070: Custom field definitions + JSONB value columns
-- =============================================================================
-- CF-01 (Layer 3 of dynamic-onboarding-fields.md). Tenant-defined extra fields
-- that can be created on the fly (incl. during import) and later PROMOTED into
-- system functions (billing/dashboard/reporting/filter/messaging/compliance).
--
--   * custom_field_definitions — one row per tenant-defined field (type, options,
--     required, promotion targets). TEXT + CHECK throughout.
--   * custom_fields JSONB — a values bag added to each core entity table. Values
--     live on the tenant-scoped row itself, so existing RLS/tenant-scoping covers
--     them (no separate EAV values table, no new isolation surface).
--
-- Guardrail: money/NCS/compliance logic only ever reads a field that has been
-- promoted WITH a validated type (enforced in app layer, src/lib/custom-fields).
-- Reads/writes go through the service-role admin client; RLS on as defence-in-depth.

CREATE TABLE public.custom_field_definitions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  entity          TEXT NOT NULL CHECK (entity IN ('child', 'parent', 'staff', 'room')),
  key             TEXT NOT NULL,
  label           TEXT NOT NULL,
  field_type      TEXT NOT NULL CHECK (field_type IN
                    ('text', 'number', 'date', 'dropdown', 'radio', 'checkbox', 'multiselect')),
  options         JSONB NOT NULL DEFAULT '[]'::jsonb,
  required        BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  -- Promotion targets this field participates in, e.g. ["billing","messaging"].
  promoted_to     JSONB NOT NULL DEFAULT '[]'::jsonb,
  affects_billing BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- One definition per (tenant, entity, key); the key is a slug of the label.
  CONSTRAINT custom_field_key_unique UNIQUE (school_id, entity, key)
);

CREATE INDEX idx_custom_field_defs_scope
  ON public.custom_field_definitions(school_id, entity, sort_order);

CREATE TRIGGER trg_custom_field_defs_updated_at
  BEFORE UPDATE ON public.custom_field_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Value bags on the core entity tables (child/parent/staff/room).
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.teachers ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.classes  ADD COLUMN IF NOT EXISTS custom_fields JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ─── RLS (defence-in-depth; service-role client does the work) ────────────────
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.custom_field_definitions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_field_definitions TO service_role;
