-- AUTO-GENERATED combined migrations for a FRESH Supabase project.
-- Run this once in the Supabase SQL Editor on a NEW empty project.
-- Contains 69 migrations (001..070). Regenerate after adding migrations.

-- ============================================================
-- 001_enums.sql
-- ============================================================
-- =============================================================================
-- Migration 001: Custom enum types
-- =============================================================================

-- User roles
CREATE TYPE public.user_role AS ENUM (
  'super_admin',
  'school_admin',
  'finance_admin',
  'teacher',
  'parent'
);

-- Order lifecycle
-- draft          → items added, not yet submitted to Stripe
-- pending_payment → Stripe Checkout Session created, awaiting payment
-- paid            → webhook confirmed payment
-- partially_refunded → one or more refunds applied, balance remains
-- fully_refunded  → entire amount refunded
-- payment_failed  → Stripe reported a failed payment attempt
-- expired         → Stripe Checkout Session expired without payment
-- cancelled       → cancelled before Stripe submission
CREATE TYPE public.order_status AS ENUM (
  'draft',
  'pending_payment',
  'paid',
  'partially_refunded',
  'fully_refunded',
  'payment_failed',
  'expired',
  'cancelled'
);

-- Payment lifecycle (mirrors Stripe's payment intent states)
CREATE TYPE public.payment_status AS ENUM (
  'pending',
  'processing',
  'paid',
  'failed',
  'expired',
  'refunded',
  'partially_refunded'
);

-- Refund lifecycle
CREATE TYPE public.refund_status AS ENUM (
  'pending',
  'processing',
  'succeeded',
  'failed',
  'cancelled'
);

-- Student identity verification for order items
-- verified  → matched via pupil payment code
-- manual    → guest name+class entry — requires MANUAL_RECONCILIATION
-- unverified → not yet reconciled by an administrator
CREATE TYPE public.verification_status AS ENUM (
  'verified',
  'manual',
  'unverified'
);

-- Activity visibility
CREATE TYPE public.publication_status AS ENUM (
  'draft',
  'published',
  'archived'
);

-- Payment gateway
CREATE TYPE public.payment_provider AS ENUM (
  'stripe'
);

-- Who made the payment
CREATE TYPE public.order_source AS ENUM (
  'registered_parent',
  'guest_code',
  'guest_manual'
);

-- Transactional email delivery states
CREATE TYPE public.email_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'skipped'
);

-- Which email template
CREATE TYPE public.email_type AS ENUM (
  'payer_receipt',
  'school_notification'
);

-- Audit log action codes
CREATE TYPE public.audit_action AS ENUM (
  'student.created',
  'student.updated',
  'student.deactivated',
  'student.pupil_code_regenerated',
  'parent_student.linked',
  'parent_student.unlinked',
  'parent_link_request.submitted',
  'parent_link_request.approved',
  'parent_link_request.rejected',
  'activity.created',
  'activity.updated',
  'activity.published',
  'activity.archived',
  'order.created',
  'payment.confirmed',
  'payment.failed',
  'payment.expired',
  'refund.requested',
  'refund.completed',
  'refund.failed',
  'reconciliation.resolved',
  'email.resent',
  'report.exported',
  'role.changed',
  'settings.updated'
);

-- Link request review states
CREATE TYPE public.link_request_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

-- ============================================================
-- 002_reference_functions.sql
-- ============================================================
-- =============================================================================
-- Migration 002: Reference number generation functions
-- =============================================================================
-- All references are generated inside the database inside a transaction
-- to guarantee uniqueness and prevent race conditions.
-- Format: PREFIX-YYYY-NNNNNN (zero-padded 6-digit sequence per year)
-- =============================================================================

-- Sequence tables (one row per year per prefix)
CREATE TABLE IF NOT EXISTS public.reference_sequences (
  prefix      TEXT NOT NULL,
  year        INTEGER NOT NULL,
  next_val    BIGINT NOT NULL DEFAULT 1,
  PRIMARY KEY (prefix, year)
);

-- Lock-safe next value function
CREATE OR REPLACE FUNCTION public.next_reference_val(p_prefix TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_val  BIGINT;
BEGIN
  INSERT INTO public.reference_sequences (prefix, year, next_val)
  VALUES (p_prefix, v_year, 2)
  ON CONFLICT (prefix, year)
  DO UPDATE SET next_val = reference_sequences.next_val + 1
  RETURNING next_val - 1 INTO v_val;

  RETURN v_val;
END;
$$;

-- Order reference: ORD-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_order_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_seq  BIGINT  := public.next_reference_val('ORD');
BEGIN
  RETURN 'ORD-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- Payment reference: PAY-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_payment_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_seq  BIGINT  := public.next_reference_val('PAY');
BEGIN
  RETURN 'PAY-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- Order item reference: ITEM-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_item_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_seq  BIGINT  := public.next_reference_val('ITEM');
BEGIN
  RETURN 'ITEM-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- Refund reference: REF-YYYY-NNNNNN
CREATE OR REPLACE FUNCTION public.generate_refund_reference()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM NOW())::INTEGER;
  v_seq  BIGINT  := public.next_reference_val('REF');
BEGIN
  RETURN 'REF-' || v_year || '-' || LPAD(v_seq::TEXT, 6, '0');
END;
$$;

-- Pupil payment code: SB-XXXXXXXX (8 random uppercase alphanumeric chars)
-- Collision-safe: caller retries if duplicate is detected (extremely rare).
CREATE OR REPLACE FUNCTION public.generate_pupil_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- omit I, O, 0, 1
  v_code  TEXT := 'SB-';
  v_i     INTEGER;
BEGIN
  FOR v_i IN 1..8 LOOP
    v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN v_code;
END;
$$;

-- ============================================================
-- 003_schools_and_settings.sql
-- ============================================================
-- =============================================================================
-- Migration 003: Schools and school settings
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.schools (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  roll_number    TEXT,                          -- Irish Dept. of Education roll number
  address_line1  TEXT,
  address_line2  TEXT,
  city           TEXT,
  county         TEXT,
  eircode        TEXT,
  phone          TEXT,
  email          TEXT,
  website        TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.school_settings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  key           TEXT NOT NULL,
  value         TEXT NOT NULL,
  description   TEXT,
  updated_by    UUID,                           -- profiles.id FK added after profiles table
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, key)
);

-- Indexes
CREATE INDEX idx_school_settings_school_id ON public.school_settings(school_id);

-- Updated-at trigger helper (reused across tables)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON public.schools
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_school_settings_updated_at
  BEFORE UPDATE ON public.school_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_settings ENABLE ROW LEVEL SECURITY;

-- Policies added in migration 010 after roles are established

-- ============================================================
-- 004_profiles_and_roles.sql
-- ============================================================
-- =============================================================================
-- Migration 004: Profiles, roles, permissions, user_roles
-- =============================================================================
-- profiles extends auth.users (one-to-one via auth.users.id FK)
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id             UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  school_id      UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  email          TEXT NOT NULL,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  phone          TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.roles (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         public.user_role NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id    UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  school_id  UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_id, school_id)
);

-- Now add the FK for school_settings.updated_by
ALTER TABLE public.school_settings
  ADD CONSTRAINT fk_school_settings_updated_by
  FOREIGN KEY (updated_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX idx_profiles_email      ON public.profiles(email);
CREATE INDEX idx_profiles_school_id  ON public.profiles(school_id);
CREATE INDEX idx_user_roles_user_id  ON public.user_roles(user_id);
CREATE INDEX idx_user_roles_school_id ON public.user_roles(school_id);

-- Triggers
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Automatically create a profile when a new auth user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name, email_verified)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
    NEW.email_confirmed_at IS NOT NULL
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update email_verified when Supabase confirms the email
CREATE OR REPLACE FUNCTION public.handle_email_confirmation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND OLD.email_confirmed_at IS NULL THEN
    UPDATE public.profiles
    SET email_verified = TRUE, updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmation();

-- Helper: get all permission names for a user in a school (used in RLS)
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID, p_school_id UUID)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT ARRAY_AGG(DISTINCT pe.name)
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions pe ON pe.id = rp.permission_id
  WHERE ur.user_id = p_user_id
    AND ur.school_id = p_school_id;
$$;

-- Helper: check if user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions pe ON pe.id = rp.permission_id
    WHERE ur.user_id = auth.uid()
      AND pe.name = p_permission
  );
$$;

-- Helper: get a user's highest role name for a school
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID, p_school_id UUID)
RETURNS public.user_role
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT r.name
  FROM public.user_roles ur
  JOIN public.roles r ON r.id = ur.role_id
  WHERE ur.user_id = p_user_id
    AND ur.school_id = p_school_id
  ORDER BY
    CASE r.name
      WHEN 'super_admin'    THEN 1
      WHEN 'school_admin'   THEN 2
      WHEN 'finance_admin'  THEN 3
      WHEN 'teacher'        THEN 4
      WHEN 'parent'         THEN 5
    END
  LIMIT 1;
$$;

-- Helper: is the current user an admin (any admin role)?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND r.name IN ('super_admin', 'school_admin', 'finance_admin')
  );
$$;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 005_classes_and_students.sql
-- ============================================================
-- =============================================================================
-- Migration 005: Classes, students, parent-student links
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.classes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, name)
);

CREATE TABLE IF NOT EXISTS public.students (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id           UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  class_id            UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  pupil_payment_code  TEXT NOT NULL UNIQUE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Prevent duplicate names in the same class (soft warning — not hard unique
  -- because two children can share names; handled at application layer)
  CONSTRAINT chk_students_names_not_empty
    CHECK (trim(first_name) <> '' AND trim(last_name) <> '')
);

CREATE TABLE IF NOT EXISTS public.parent_student_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  relationship TEXT,                    -- e.g. 'parent', 'guardian'
  linked_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (parent_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.parent_link_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id        UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  status           public.link_request_status NOT NULL DEFAULT 'pending',
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at      TIMESTAMPTZ,
  reviewed_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Only one pending request per parent+student at a time
  UNIQUE (parent_id, student_id, status)
);

-- Indexes
CREATE INDEX idx_students_school_id        ON public.students(school_id);
CREATE INDEX idx_students_class_id         ON public.students(class_id);
CREATE INDEX idx_students_pupil_code       ON public.students(pupil_payment_code);
CREATE INDEX idx_students_active           ON public.students(school_id, is_active);
CREATE INDEX idx_psl_parent_id             ON public.parent_student_links(parent_id);
CREATE INDEX idx_psl_student_id            ON public.parent_student_links(student_id);
CREATE INDEX idx_plr_parent_id             ON public.parent_link_requests(parent_id);
CREATE INDEX idx_plr_status                ON public.parent_link_requests(status);

-- Triggers
CREATE TRIGGER trg_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_students_updated_at
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_psl_updated_at
  BEFORE UPDATE ON public.parent_student_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_plr_updated_at
  BEFORE UPDATE ON public.parent_link_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_student_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parent_link_requests ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 006_activities.sql
-- ============================================================
-- =============================================================================
-- Migration 006: Activities and class eligibility
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.activities (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id          UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  -- Amount stored in integer euro cents to avoid floating-point issues
  amount_cents       INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency           TEXT NOT NULL DEFAULT 'EUR',
  accounting_code    TEXT,                         -- optional GL / cost-centre code
  opens_at           TIMESTAMPTZ,                  -- NULL = open immediately when published
  closes_at          TIMESTAMPTZ,                  -- NULL = no closing date
  publication_status public.publication_status NOT NULL DEFAULT 'draft',
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_activities_name_not_empty CHECK (trim(name) <> ''),
  CONSTRAINT chk_activities_dates
    CHECK (closes_at IS NULL OR opens_at IS NULL OR closes_at > opens_at)
);

-- Junction table: which classes are eligible for each activity
CREATE TABLE IF NOT EXISTS public.activity_class_eligibility (
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  class_id    UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_id, class_id)
);

-- Indexes
CREATE INDEX idx_activities_school_id          ON public.activities(school_id);
CREATE INDEX idx_activities_publication_status ON public.activities(school_id, publication_status);
CREATE INDEX idx_activities_closes_at          ON public.activities(closes_at);
CREATE INDEX idx_ace_activity_id               ON public.activity_class_eligibility(activity_id);
CREATE INDEX idx_ace_class_id                  ON public.activity_class_eligibility(class_id);

-- Trigger
CREATE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_class_eligibility ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 007_orders_and_payments.sql
-- ============================================================
-- =============================================================================
-- Migration 007: Orders, order items, payments
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.orders (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  order_reference   TEXT NOT NULL UNIQUE DEFAULT public.generate_order_reference(),
  payer_profile_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  guest_payer_name  TEXT,
  guest_payer_email TEXT,
  currency          TEXT NOT NULL DEFAULT 'EUR',
  subtotal_cents    INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  total_cents       INTEGER NOT NULL CHECK (total_cents >= 0),
  status            public.order_status NOT NULL DEFAULT 'draft',
  source            public.order_source NOT NULL,
  correlation_id    TEXT,               -- request-scoped tracing ID
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Must have either a registered payer or guest details
  CONSTRAINT chk_orders_payer
    CHECK (
      payer_profile_id IS NOT NULL
      OR (guest_payer_name IS NOT NULL AND guest_payer_email IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                   UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  -- Linked student (NULL for manual guest entries)
  student_id                 UUID REFERENCES public.students(id) ON DELETE SET NULL,
  -- Manual guest entry fields
  manual_student_first_name  TEXT,
  manual_student_last_name   TEXT,
  -- class_id retained for foreign-key integrity; snapshot used for display/reports
  class_id                   UUID NOT NULL REFERENCES public.classes(id) ON DELETE RESTRICT,
  -- Snapshots preserve historical accuracy if student/class/activity data changes later
  student_name_snapshot      TEXT NOT NULL,
  class_name_snapshot        TEXT NOT NULL,
  activity_id                UUID NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,
  activity_name_snapshot     TEXT NOT NULL,
  -- Price locked at the time of order creation — never recalculate from live activity
  unit_amount_cents          INTEGER NOT NULL CHECK (unit_amount_cents >= 0),
  item_reference             TEXT NOT NULL UNIQUE DEFAULT public.generate_item_reference(),
  verification_status        public.verification_status NOT NULL DEFAULT 'unverified',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Either a known student or manual name fields must be supplied
  CONSTRAINT chk_order_items_student
    CHECK (
      student_id IS NOT NULL
      OR (manual_student_first_name IS NOT NULL AND manual_student_last_name IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.payments (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                    UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_reference           TEXT NOT NULL UNIQUE DEFAULT public.generate_payment_reference(),
  provider                    public.payment_provider NOT NULL DEFAULT 'stripe',
  provider_checkout_session_id TEXT,
  provider_payment_intent_id  TEXT,
  amount_cents                INTEGER NOT NULL CHECK (amount_cents >= 0),
  refunded_amount_cents       INTEGER NOT NULL DEFAULT 0 CHECK (refunded_amount_cents >= 0),
  currency                    TEXT NOT NULL DEFAULT 'EUR',
  status                      public.payment_status NOT NULL DEFAULT 'pending',
  paid_at                     TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Refunded amount cannot exceed paid amount
  CONSTRAINT chk_payments_refund_amount
    CHECK (refunded_amount_cents <= amount_cents)
);

-- Indexes
CREATE INDEX idx_orders_school_id         ON public.orders(school_id);
CREATE INDEX idx_orders_status            ON public.orders(school_id, status);
CREATE INDEX idx_orders_payer_profile_id  ON public.orders(payer_profile_id);
CREATE INDEX idx_orders_order_reference   ON public.orders(order_reference);
CREATE INDEX idx_orders_created_at        ON public.orders(created_at DESC);
CREATE INDEX idx_order_items_order_id     ON public.order_items(order_id);
CREATE INDEX idx_order_items_student_id   ON public.order_items(student_id);
CREATE INDEX idx_order_items_activity_id  ON public.order_items(activity_id);
CREATE INDEX idx_payments_order_id        ON public.payments(order_id);
CREATE INDEX idx_payments_session_id      ON public.payments(provider_checkout_session_id);
CREATE INDEX idx_payments_intent_id       ON public.payments(provider_payment_intent_id);
CREATE INDEX idx_payments_status          ON public.payments(status);

-- Trigger
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 008_refunds_webhooks_emails_audit.sql
-- ============================================================
-- =============================================================================
-- Migration 008: Refunds, webhook events, email notifications, audit logs
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.refunds (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id        UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  order_id          UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  refund_reference  TEXT NOT NULL UNIQUE DEFAULT public.generate_refund_reference(),
  amount_cents      INTEGER NOT NULL CHECK (amount_cents > 0),
  currency          TEXT NOT NULL DEFAULT 'EUR',
  reason            TEXT,
  status            public.refund_status NOT NULL DEFAULT 'pending',
  provider_refund_id TEXT,             -- Stripe refund ID (re_...)
  requested_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency table for Stripe webhook events.
-- The unique constraint on (provider, event_id) prevents duplicate processing.
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      public.payment_provider NOT NULL DEFAULT 'stripe',
  event_id      TEXT NOT NULL,          -- Stripe event ID (evt_...)
  event_type    TEXT NOT NULL,
  payload       JSONB NOT NULL,
  processed     BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at  TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, event_id)
);

CREATE TABLE IF NOT EXISTS public.email_notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  type                public.email_type NOT NULL,
  recipient_email     TEXT NOT NULL,
  subject             TEXT NOT NULL,
  status              public.email_status NOT NULL DEFAULT 'pending',
  provider_message_id TEXT,             -- Resend message ID
  failure_details     TEXT,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  last_attempted_at   TIMESTAMPTZ,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Append-only audit log — no UPDATE or DELETE policies
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  actor_id      UUID,                   -- auth.users.id (not FK to allow log after user deletion)
  actor_email   TEXT,
  action        public.audit_action NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id   TEXT,
  metadata      JSONB,                  -- safe non-sensitive context only
  correlation_id TEXT,
  ip_address    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_refunds_payment_id       ON public.refunds(payment_id);
CREATE INDEX idx_refunds_order_id         ON public.refunds(order_id);
CREATE INDEX idx_refunds_status           ON public.refunds(status);
CREATE INDEX idx_webhook_events_event_id  ON public.webhook_events(event_id);
CREATE INDEX idx_webhook_events_processed ON public.webhook_events(processed, created_at DESC);
CREATE INDEX idx_email_notifs_order_id    ON public.email_notifications(order_id);
CREATE INDEX idx_email_notifs_status      ON public.email_notifications(status);
CREATE INDEX idx_audit_logs_actor_id      ON public.audit_logs(actor_id);
CREATE INDEX idx_audit_logs_action        ON public.audit_logs(action);
CREATE INDEX idx_audit_logs_resource      ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at    ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_school_id     ON public.audit_logs(school_id, created_at DESC);

-- Triggers
CREATE TRIGGER trg_refunds_updated_at
  BEFORE UPDATE ON public.refunds
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_email_notifs_updated_at
  BEFORE UPDATE ON public.email_notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 009_seed_roles_and_permissions.sql
-- ============================================================
-- =============================================================================
-- Migration 009: Seed roles and permissions
-- =============================================================================

-- Roles
INSERT INTO public.roles (name, display_name, description) VALUES
  ('super_admin',   'Super Administrator', 'Full system access including school configuration and role management'),
  ('school_admin',  'School Administrator', 'Manages students, activities, payments and reports'),
  ('finance_admin', 'Finance Administrator', 'Views payments, issues refunds, exports reports'),
  ('teacher',       'Teacher', 'Views payment status for authorised classes'),
  ('parent',        'Parent / Guardian', 'Makes payments for linked children')
ON CONFLICT (name) DO NOTHING;

-- Permissions
INSERT INTO public.permissions (name, description) VALUES
  -- School configuration
  ('school.configure',           'Configure school details and settings'),
  -- User & role management
  ('users.manage',               'Create, deactivate and assign roles to users'),
  ('roles.assign',               'Assign roles to users'),
  -- Student management
  ('students.create',            'Create new student records'),
  ('students.update',            'Edit student records'),
  ('students.deactivate',        'Deactivate students'),
  ('students.view',              'View student records'),
  ('students.view_class',        'View students in authorised classes only'),
  -- Parent linking
  ('parent_links.manage',        'Create and remove parent-student links'),
  ('parent_links.approve',       'Approve or reject parent link requests'),
  -- Activity management
  ('activities.create',          'Create activities'),
  ('activities.update',          'Edit activities'),
  ('activities.publish',         'Publish or archive activities'),
  ('activities.view',            'View all activities'),
  -- Order & payment management
  ('orders.view',                'View all orders'),
  ('payments.view',              'View all payments'),
  ('payments.refund',            'Issue refunds'),
  ('reconciliation.resolve',     'Resolve manual reconciliation items'),
  -- Reports
  ('reports.view',               'View reports'),
  ('reports.export',             'Export reports as CSV'),
  -- Audit
  ('audit.view',                 'View audit logs'),
  -- Email
  ('emails.resend',              'Resend notification emails'),
  -- Parent-specific
  ('parent.pay',                 'Make payments for linked children'),
  ('parent.view_own',            'View own orders and receipts')
ON CONFLICT (name) DO NOTHING;

-- ─── Role → Permission assignments ───────────────────────────────────────────

-- Super admin gets everything
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'super_admin'
ON CONFLICT DO NOTHING;

-- School admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'school_admin'
  AND p.name IN (
    'students.create', 'students.update', 'students.deactivate', 'students.view',
    'parent_links.manage', 'parent_links.approve',
    'activities.create', 'activities.update', 'activities.publish', 'activities.view',
    'orders.view', 'payments.view', 'payments.refund',
    'reconciliation.resolve',
    'reports.view', 'reports.export',
    'emails.resend'
  )
ON CONFLICT DO NOTHING;

-- Finance admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'finance_admin'
  AND p.name IN (
    'students.view',
    'activities.view',
    'orders.view', 'payments.view', 'payments.refund',
    'reconciliation.resolve',
    'reports.view', 'reports.export',
    'audit.view',
    'emails.resend'
  )
ON CONFLICT DO NOTHING;

-- Teacher
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'teacher'
  AND p.name IN (
    'students.view_class',
    'activities.view'
  )
ON CONFLICT DO NOTHING;

-- Parent
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.name = 'parent'
  AND p.name IN (
    'parent.pay',
    'parent.view_own'
  )
ON CONFLICT DO NOTHING;

-- ============================================================
-- 010_rls_policies.sql
-- ============================================================
-- =============================================================================
-- Migration 010: Row Level Security policies
-- =============================================================================
-- Service-role operations bypass RLS (correct by design).
-- Browser clients use the anon key and are subject to all policies below.
-- =============================================================================

-- ─── schools ─────────────────────────────────────────────────────────────────

-- Admins can read their school; public cannot see school records
CREATE POLICY "admins_read_school" ON public.schools
  FOR SELECT USING (public.is_admin());

CREATE POLICY "super_admin_manage_schools" ON public.schools
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- ─── school_settings ─────────────────────────────────────────────────────────

CREATE POLICY "admins_read_school_settings" ON public.school_settings
  FOR SELECT USING (public.is_admin());

CREATE POLICY "super_admin_manage_school_settings" ON public.school_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- ─── profiles ────────────────────────────────────────────────────────────────

-- Users can read and update their own profile
CREATE POLICY "users_read_own_profile" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_update_own_profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Admins can read all profiles in their school
CREATE POLICY "admins_read_profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "admins_manage_profiles" ON public.profiles
  FOR ALL USING (public.is_admin());

-- ─── roles / permissions / role_permissions / user_roles ─────────────────────

CREATE POLICY "authenticated_read_roles" ON public.roles
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "authenticated_read_permissions" ON public.permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "authenticated_read_role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (TRUE);

CREATE POLICY "users_read_own_user_roles" ON public.user_roles
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "admins_read_user_roles" ON public.user_roles
  FOR SELECT USING (public.is_admin());

CREATE POLICY "super_admin_manage_user_roles" ON public.user_roles
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.roles r ON r.id = ur.role_id
      WHERE ur.user_id = auth.uid() AND r.name = 'super_admin'
    )
  );

-- ─── classes ─────────────────────────────────────────────────────────────────

-- All authenticated users can read classes (needed for dropdowns)
CREATE POLICY "authenticated_read_classes" ON public.classes
  FOR SELECT TO authenticated USING (TRUE);

-- Anon users can read classes (needed for guest payment class dropdown)
CREATE POLICY "anon_read_classes" ON public.classes
  FOR SELECT TO anon USING (is_active = TRUE);

CREATE POLICY "admins_manage_classes" ON public.classes
  FOR ALL USING (public.is_admin());

-- ─── students ────────────────────────────────────────────────────────────────

-- Parents see only students linked to them
CREATE POLICY "parents_read_linked_students" ON public.students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parent_student_links psl
      WHERE psl.student_id = students.id
        AND psl.parent_id = auth.uid()
        AND psl.is_active = TRUE
    )
  );

-- Teachers see students in their authorised classes
-- (teacher_class_assignments table added in Phase 3; stubbed here)
CREATE POLICY "teachers_read_class_students" ON public.students
  FOR SELECT USING (
    public.user_has_permission('students.view_class')
    -- Additional class restriction enforced at application layer in Phase 3
  );

-- Admins can manage all students in their school
CREATE POLICY "admins_manage_students" ON public.students
  FOR ALL USING (public.user_has_permission('students.view'));

-- Guests cannot query the students table directly
-- (no policy = no access for anon role)

-- ─── parent_student_links ────────────────────────────────────────────────────

CREATE POLICY "parents_read_own_links" ON public.parent_student_links
  FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "admins_manage_parent_links" ON public.parent_student_links
  FOR ALL USING (public.user_has_permission('parent_links.manage'));

-- ─── parent_link_requests ────────────────────────────────────────────────────

CREATE POLICY "parents_read_own_requests" ON public.parent_link_requests
  FOR SELECT USING (parent_id = auth.uid());

CREATE POLICY "parents_create_requests" ON public.parent_link_requests
  FOR INSERT WITH CHECK (parent_id = auth.uid());

CREATE POLICY "admins_manage_link_requests" ON public.parent_link_requests
  FOR ALL USING (public.user_has_permission('parent_links.approve'));

-- ─── activities ──────────────────────────────────────────────────────────────

-- Authenticated users and guests see published, active activities
CREATE POLICY "public_read_published_activities" ON public.activities
  FOR SELECT USING (
    publication_status = 'published'
    AND is_active = TRUE
    AND (opens_at IS NULL OR opens_at <= NOW())
    AND (closes_at IS NULL OR closes_at > NOW())
  );

CREATE POLICY "admins_read_all_activities" ON public.activities
  FOR SELECT USING (public.user_has_permission('activities.view'));

CREATE POLICY "admins_manage_activities" ON public.activities
  FOR ALL USING (public.user_has_permission('activities.create'));

-- ─── activity_class_eligibility ──────────────────────────────────────────────

CREATE POLICY "public_read_eligibility" ON public.activity_class_eligibility
  FOR SELECT USING (TRUE);

CREATE POLICY "admins_manage_eligibility" ON public.activity_class_eligibility
  FOR ALL USING (public.user_has_permission('activities.create'));

-- ─── orders ──────────────────────────────────────────────────────────────────

-- Registered parents see their own orders
CREATE POLICY "parents_read_own_orders" ON public.orders
  FOR SELECT USING (payer_profile_id = auth.uid());

CREATE POLICY "parents_create_orders" ON public.orders
  FOR INSERT WITH CHECK (
    payer_profile_id = auth.uid()
    OR payer_profile_id IS NULL  -- guest orders created server-side
  );

CREATE POLICY "admins_read_all_orders" ON public.orders
  FOR SELECT USING (public.user_has_permission('orders.view'));

CREATE POLICY "admins_update_orders" ON public.orders
  FOR UPDATE USING (public.user_has_permission('orders.view'));

-- ─── order_items ─────────────────────────────────────────────────────────────

-- Parents see items on their own orders
CREATE POLICY "parents_read_own_order_items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.payer_profile_id = auth.uid()
    )
  );

CREATE POLICY "admins_read_all_order_items" ON public.order_items
  FOR SELECT USING (public.user_has_permission('orders.view'));

CREATE POLICY "admins_manage_order_items" ON public.order_items
  FOR ALL USING (public.user_has_permission('orders.view'));

-- ─── payments ────────────────────────────────────────────────────────────────

CREATE POLICY "parents_read_own_payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payments.order_id
        AND o.payer_profile_id = auth.uid()
    )
  );

CREATE POLICY "admins_read_all_payments" ON public.payments
  FOR SELECT USING (public.user_has_permission('payments.view'));

CREATE POLICY "admins_manage_payments" ON public.payments
  FOR ALL USING (public.user_has_permission('payments.view'));

-- ─── refunds ─────────────────────────────────────────────────────────────────

CREATE POLICY "parents_read_own_refunds" ON public.refunds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = refunds.order_id
        AND o.payer_profile_id = auth.uid()
    )
  );

CREATE POLICY "admins_read_all_refunds" ON public.refunds
  FOR SELECT USING (public.user_has_permission('payments.view'));

CREATE POLICY "admins_manage_refunds" ON public.refunds
  FOR ALL USING (public.user_has_permission('payments.refund'));

-- ─── webhook_events ──────────────────────────────────────────────────────────

-- Webhook events are managed exclusively via service role (no user policies)
-- Admins can view for debugging
CREATE POLICY "admins_read_webhook_events" ON public.webhook_events
  FOR SELECT USING (public.user_has_permission('payments.view'));

-- ─── email_notifications ─────────────────────────────────────────────────────

CREATE POLICY "admins_manage_email_notifs" ON public.email_notifications
  FOR ALL USING (public.user_has_permission('emails.resend'));

-- ─── audit_logs ──────────────────────────────────────────────────────────────

-- Audit logs are append-only — no UPDATE or DELETE policies
CREATE POLICY "admins_read_audit_logs" ON public.audit_logs
  FOR SELECT USING (public.user_has_permission('audit.view'));

-- Only service role (server-side) can insert audit logs
-- Revoke direct insert from authenticated role
REVOKE INSERT ON public.audit_logs FROM authenticated;
REVOKE INSERT ON public.audit_logs FROM anon;

-- ============================================================
-- 011_verification_status_update.sql
-- ============================================================
-- =============================================================================
-- Migration 011: Extend verification_status enum to match SRS §9.2
-- =============================================================================
-- SRS §9.2 specifies: VERIFIED_LINK, VERIFIED_CODE, MANUAL_REVIEW, MANUALLY_MATCHED
-- The original enum used collapsed values ('verified', 'manual', 'unverified').
-- This migration adds the spec-compliant values without removing the legacy ones
-- (PostgreSQL does not support removing enum values without recreating the type).
-- New code uses the spec values; old values remain for any existing rows.

ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'verified_link';
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'verified_code';
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'manual_review';
ALTER TYPE public.verification_status ADD VALUE IF NOT EXISTS 'manually_matched';

-- ============================================================
-- 012_teachers.sql
-- ============================================================
-- =============================================================================
-- Migration 012: Teachers
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.teachers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id  UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name  TEXT NOT NULL,
  email      TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_teachers_names_not_empty
    CHECK (trim(first_name) <> '' AND trim(last_name) <> '')
);

-- Indexes
CREATE INDEX idx_teachers_school_id ON public.teachers(school_id);
CREATE INDEX idx_teachers_active    ON public.teachers(school_id, is_active);

-- Trigger
CREATE TRIGGER trg_teachers_updated_at
  BEFORE UPDATE ON public.teachers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;

-- Admins can fully manage teachers
CREATE POLICY "admins_manage_teachers" ON public.teachers
  FOR ALL USING (public.is_admin());

-- Authenticated users (parents, teachers) can read active teachers
-- (needed for payer-facing class/teacher display)
CREATE POLICY "authenticated_read_active_teachers" ON public.teachers
  FOR SELECT TO authenticated USING (is_active = TRUE);

-- Anon users can read active teachers (needed for guest payment class display)
CREATE POLICY "anon_read_active_teachers" ON public.teachers
  FOR SELECT TO anon USING (is_active = TRUE);

-- ============================================================
-- 013_classes_add_teacher_year.sql
-- ============================================================
-- =============================================================================
-- Migration 013: Add teacher_id and academic_year to classes
-- =============================================================================
-- teacher_id is nullable; a class may exist before a teacher is assigned.
-- ON DELETE SET NULL ensures removing a teacher record does not cascade-delete classes.
-- academic_year is a free-text label (e.g. '2025-2026').

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS teacher_id    UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS academic_year TEXT;

CREATE INDEX idx_classes_teacher_id ON public.classes(teacher_id);

-- ============================================================
-- 014_payment_links.sql
-- ============================================================
-- =============================================================================
-- Migration 014: Payment links
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;
-- A payment link is a stable, shareable URL that pre-selects a specific
-- activity and records which admin created it.  The public_token is a
-- cryptographically secure random value; it is NOT the primary key so it
-- can be rotated without breaking foreign-key references.
--
-- Security invariants:
--   • Possession of a link does NOT bypass student validation, price
--     calculation, activity eligibility checks, or Stripe webhook confirmation.
--   • The public_token is the ONLY value exposed in the URL.  The activity_id
--     and internal IDs are NEVER placed in the shareable URL.
--   • use_count is incremented server-side only (never from client input).

CREATE TABLE IF NOT EXISTS public.payment_links (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID        NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  activity_id  UUID        NOT NULL REFERENCES public.activities(id) ON DELETE RESTRICT,
  created_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  label        TEXT        NOT NULL,
  public_token TEXT        NOT NULL UNIQUE
                           DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  expires_at   TIMESTAMPTZ,
  max_uses     INTEGER     CHECK (max_uses IS NULL OR max_uses > 0),
  use_count    INTEGER     NOT NULL DEFAULT 0 CHECK (use_count >= 0),
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_payment_links_school_id    ON public.payment_links(school_id);
CREATE INDEX idx_payment_links_activity_id  ON public.payment_links(activity_id);
CREATE INDEX idx_payment_links_public_token ON public.payment_links(public_token);
CREATE INDEX idx_payment_links_active       ON public.payment_links(school_id, is_active);

-- Trigger
CREATE TRIGGER trg_payment_links_updated_at
  BEFORE UPDATE ON public.payment_links
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.payment_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins_manage_payment_links" ON public.payment_links
  FOR ALL USING (public.is_admin());

-- Anon/authenticated can read an active, non-expired link by public_token
-- (used by the /pay/[token] route to validate and display the activity).
-- The policy exposes no sensitive school data — only the record selected
-- by a specific token the visitor already possesses.
CREATE POLICY "public_read_active_payment_link_by_token" ON public.payment_links
  FOR SELECT USING (
    is_active = TRUE
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR use_count < max_uses)
  );

-- ============================================================
-- 015_order_items_teacher_snapshot.sql
-- ============================================================
-- =============================================================================
-- Migration 015: Add teacher_name_snapshot to order_items
-- =============================================================================
-- Nullable because orders created before teacher assignment (or for activities
-- without an assigned teacher) carry no teacher snapshot.
-- The snapshot is locked at order creation — subsequent teacher renames do
-- not affect historical records.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS teacher_name_snapshot TEXT;

-- ============================================================
-- 016_orders_payment_link.sql
-- ============================================================
-- =============================================================================
-- Migration 016: Add payment_link_id and acquisition tracking to orders
-- =============================================================================
-- payment_link_id records which payment link originated the order (if any).
-- ON DELETE SET NULL so deleting a link does not remove historical orders.
--
-- acquisition_source / source_reference are free-text attribution fields
-- (e.g. source='payment_link', reference=<payment_link.label>).
-- These are supplementary audit fields — the canonical link is payment_link_id.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_link_id     UUID REFERENCES public.payment_links(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acquisition_source  TEXT,
  ADD COLUMN IF NOT EXISTS source_reference    TEXT;

CREATE INDEX idx_orders_payment_link_id ON public.orders(payment_link_id);

-- ============================================================
-- 017_seed_teachers.sql
-- ============================================================
-- =============================================================================
-- Migration 017: Seed fictional teachers and assign to classes
-- =============================================================================
-- ALL DATA IS FICTIONAL.  No real staff information is used.

-- ─── Foundation seed (school + classes must exist before teachers FK) ─────────

INSERT INTO public.schools (id, name, roll_number, address_line1, city, county, eircode, phone, email, website)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Scoil Bhríde',
  '12345A',
  '1 School Road',
  'Citywest',
  'Dublin',
  'D24 AB12',
  '01 123 4567',
  'office@scoilbhride.example.ie',
  'https://www.scoilbhride.example.ie'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO public.school_settings (school_id, key, value, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'notification_email', 'office@scoilbhride.example.ie', 'General school notification email address'),
  ('00000000-0000-0000-0000-000000000001', 'portal_name', 'Scoil Bhríde Payment Portal', 'Display name for the portal'),
  ('00000000-0000-0000-0000-000000000001', 'currency', 'EUR', 'Payment currency'),
  ('00000000-0000-0000-0000-000000000001', 'stripe_mode', 'test', 'Stripe environment: test or live'),
  ('00000000-0000-0000-0000-000000000001', 'data_retention_months', '84', 'Data retention period in months (7 years default)')
ON CONFLICT (school_id, key) DO NOTHING;

INSERT INTO public.classes (id, school_id, name, display_order)
VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Junior Infants',  1),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Senior Infants',  2),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'First Class',     3),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Second Class',    4),
  ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Third Class',     5),
  ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Fourth Class',    6),
  ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Fifth Class',     7),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Sixth Class',     8)
ON CONFLICT (id) DO NOTHING;

-- ─── Fictional teachers ───────────────────────────────────────────────────────

INSERT INTO public.teachers (id, school_id, first_name, last_name, email, is_active)
VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Máire',    'Ní Bhriain',       'mbriain@scoilbhride.example.ie',          TRUE),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Seán',     'Ó Dochartaigh',    'sodochartaigh@scoilbhride.example.ie',    TRUE),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Caoimhe',  'Mhic Gearailt',    'cmhicgearailt@scoilbhride.example.ie',    TRUE),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Pádraig',  'Ó Maolalaidh',     'pomaolalaidh@scoilbhride.example.ie',     TRUE),
  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Bríd',     'Uí Cheallaigh',    'buiceallaigh@scoilbhride.example.ie',     TRUE),
  ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Tomás',    'Mac Cormaic',      'tmaccormaic@scoilbhride.example.ie',      TRUE),
  ('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Aoife',    'Ní Shúilleabháin', 'anishuilleabhain@scoilbhride.example.ie', TRUE),
  ('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Ciarán',   'Ó Briain',         'cobriain@scoilbhride.example.ie',         TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─── Assign teachers to classes (2025–2026 academic year) ────────────────────

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000001',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000001';  -- Junior Infants

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000002',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000002';  -- Senior Infants

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000003',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000003';  -- First Class

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000004',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000004';  -- Second Class

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000005',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000005';  -- Third Class

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000006',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000006';  -- Fourth Class

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000007',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000007';  -- Fifth Class

UPDATE public.classes
SET teacher_id    = '40000000-0000-0000-0000-000000000008',
    academic_year = '2025-2026'
WHERE id = '10000000-0000-0000-0000-000000000008';  -- Sixth Class

-- ============================================================
-- 018_teachers_display_name_payment_links_columns.sql
-- ============================================================
-- =============================================================================
-- Migration 018: Add display_name to teachers; add opens_at, visit_count,
--                completed_order_count to payment_links
-- =============================================================================
-- display_name is the short name shown in payment references, e.g. "Ms Kelly".
-- Defaults to first_name || ' ' || last_name if not set.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Set honorific display names for seed teachers; fall back to first + last for any others
UPDATE public.teachers SET display_name = CASE id
  WHEN '40000000-0000-0000-0000-000000000001' THEN 'Ms Ní Bhriain'
  WHEN '40000000-0000-0000-0000-000000000002' THEN 'Mr Ó Dochartaigh'
  WHEN '40000000-0000-0000-0000-000000000003' THEN 'Ms Mhic Gearailt'
  WHEN '40000000-0000-0000-0000-000000000004' THEN 'Mr Ó Maolalaidh'
  WHEN '40000000-0000-0000-0000-000000000005' THEN 'Ms Uí Cheallaigh'
  WHEN '40000000-0000-0000-0000-000000000006' THEN 'Mr Mac Cormaic'
  WHEN '40000000-0000-0000-0000-000000000007' THEN 'Ms Ní Shúilleabháin'
  WHEN '40000000-0000-0000-0000-000000000008' THEN 'Mr Ó Briain'
  ELSE first_name || ' ' || last_name
END
WHERE display_name IS NULL;

-- opens_at lets a payment link have a future open date (analogous to activities.opens_at)
ALTER TABLE public.payment_links
  ADD COLUMN IF NOT EXISTS opens_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS visit_count INTEGER NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  ADD COLUMN IF NOT EXISTS completed_order_count INTEGER NOT NULL DEFAULT 0 CHECK (completed_order_count >= 0);

-- Update the public RLS policy to also enforce opens_at
DROP POLICY IF EXISTS "public_read_active_payment_link_by_token" ON public.payment_links;

CREATE POLICY "public_read_active_payment_link_by_token" ON public.payment_links
  FOR SELECT USING (
    is_active = TRUE
    AND (opens_at   IS NULL OR opens_at   <= NOW())
    AND (expires_at IS NULL OR expires_at  > NOW())
    AND (max_uses   IS NULL OR use_count   < max_uses)
  );

-- ============================================================
-- 019_service_role_grants.sql
-- ============================================================
-- Grant ALL privileges on every public table and sequence to service_role.
--
-- In this Supabase project the service_role PostgreSQL role does not receive
-- automatic DML grants when tables are created via migrations (the default
-- ALTER DEFAULT PRIVILEGES grant is not in effect). Without explicit grants
-- service_role can bypass RLS but still gets a PostgreSQL 42501 error for any
-- SELECT, INSERT, UPDATE, or DELETE it attempts.
--
-- These grants are idempotent and safe to re-run.

-- Schema usage
GRANT USAGE ON SCHEMA public TO service_role;

-- All tables
GRANT ALL ON public.profiles                    TO service_role;
GRANT ALL ON public.user_roles                  TO service_role;
GRANT ALL ON public.roles                       TO service_role;
GRANT ALL ON public.permissions                 TO service_role;
GRANT ALL ON public.role_permissions            TO service_role;
GRANT ALL ON public.schools                     TO service_role;
GRANT ALL ON public.school_settings             TO service_role;
GRANT ALL ON public.classes                     TO service_role;
GRANT ALL ON public.students                    TO service_role;
GRANT ALL ON public.teachers                    TO service_role;
GRANT ALL ON public.activities                  TO service_role;
GRANT ALL ON public.activity_class_eligibility  TO service_role;
GRANT ALL ON public.orders                      TO service_role;
GRANT ALL ON public.order_items                 TO service_role;
GRANT ALL ON public.payments                    TO service_role;
GRANT ALL ON public.refunds                     TO service_role;
GRANT ALL ON public.webhook_events              TO service_role;
GRANT ALL ON public.audit_logs                  TO service_role;
GRANT ALL ON public.email_notifications         TO service_role;
GRANT ALL ON public.parent_student_links        TO service_role;
GRANT ALL ON public.parent_link_requests        TO service_role;
GRANT ALL ON public.payment_links               TO service_role;

-- Sequences (needed for any SERIAL / IDENTITY columns and for nextval() calls)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================
-- 020_service_role_dml_grants.sql
-- ============================================================
-- Grant INSERT, UPDATE, DELETE on all public tables to service_role.
--
-- Migration 019 was applied to the live database with SELECT-only grants.
-- This migration adds the missing DML permissions so that admin server
-- actions (updateStudentAction, createActivityAction, initiateRefundAction,
-- audit log writes, etc.) no longer fail with PostgreSQL error 42501.
--
-- These grants are idempotent and safe to re-run.

-- Schema usage (idempotent)
GRANT USAGE ON SCHEMA public TO service_role;

-- DML grants for every application-writable table
GRANT INSERT, UPDATE, DELETE ON public.profiles                   TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.schools                    TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.school_settings            TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.classes                    TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.students                   TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.teachers                   TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.activities                 TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.activity_class_eligibility TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.orders                     TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.order_items                TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.payments                   TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.refunds                    TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.webhook_events             TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.audit_logs                 TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.email_notifications        TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.parent_student_links       TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.parent_link_requests       TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.payment_links              TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.user_roles                 TO service_role;

-- Sequences
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ============================================================
-- 021_anon_authenticated_grants.sql
-- ============================================================
-- Grant SELECT to anon and authenticated on all publicly-readable tables.
--
-- In this Supabase project, ALTER DEFAULT PRIVILEGES was not set up for the
-- anon and authenticated roles, so tables created via migrations have no
-- table-level grants for those roles. PostgreSQL evaluates RLS policies AFTER
-- checking table-level privileges — without an explicit GRANT SELECT, every
-- anon/authenticated query fails with 42501 permission denied before the RLS
-- policy is even consulted.
--
-- RLS policies in migration 010 already define what each role can see.
-- These grants allow PostgreSQL to reach those policies.
--
-- All grants are SELECT-only. INSERT/UPDATE/DELETE for authenticated users
-- go through server actions that use createSupabaseAdminClient() (service role).
--
-- These grants are idempotent and safe to re-run.

-- Schema usage (required for any table access)
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ── Public / anon-readable tables ────────────────────────────────────────────
-- activities: filtered to published+active+open by RLS policy public_read_published_activities
GRANT SELECT ON public.activities                 TO anon, authenticated;

-- activity_class_eligibility: RLS policy public_read_eligibility allows SELECT USING (TRUE)
GRANT SELECT ON public.activity_class_eligibility TO anon, authenticated;

-- classes: anon_read_classes (is_active=TRUE); authenticated_read_classes (TRUE)
GRANT SELECT ON public.classes                    TO anon, authenticated;

-- schools and school_settings: needed for school name / contact details display
GRANT SELECT ON public.schools                    TO anon, authenticated;
GRANT SELECT ON public.school_settings            TO anon, authenticated;

-- payment_links: RLS policy public_read_active_payment_link_by_token (token lookup)
GRANT SELECT ON public.payment_links              TO anon, authenticated;

-- teachers: RLS policy authenticated_read_active_teachers (is_active=TRUE)
GRANT SELECT ON public.teachers                   TO anon, authenticated;

-- ── Authenticated-only tables ─────────────────────────────────────────────────
-- These tables are only ever queried by logged-in parents via server actions.
-- The server actions use createSupabaseAdminClient() (service role) so these
-- grants are not strictly required for current code, but they are listed here
-- for completeness and in case a future page uses the server client directly.

-- parent_student_links: parents_read_own_links RLS policy
GRANT SELECT ON public.parent_student_links       TO authenticated;

-- parent_link_requests: parents_read_own_requests RLS policy
GRANT SELECT ON public.parent_link_requests       TO authenticated;

-- orders: parents_read_own_orders RLS policy
GRANT SELECT ON public.orders                     TO authenticated;

-- order_items: parents_read_own_order_items RLS policy
GRANT SELECT ON public.order_items                TO authenticated;

-- payments: no direct parent-read policy yet; included for completeness
GRANT SELECT ON public.payments                   TO authenticated;

-- profiles: users_read_own_profile RLS policy (SELECT where id = auth.uid())
GRANT SELECT ON public.profiles                   TO authenticated;

-- ============================================================
-- 022_audit_action_enum_extensions.sql
-- ============================================================
-- =============================================================================
-- Migration 022: Extend audit_action enum with Phase 10 action codes
-- =============================================================================
-- The original 001_enums.sql audit_action enum did not include action codes
-- added during Phase 10 (teachers, classes, payment links).  These values were
-- added to the TypeScript AuditAction union in database.ts but were never
-- persisted to the PostgreSQL enum, causing silent audit-log insert failures
-- whenever a teacher, class, or payment-link write was attempted in the live DB.
-- This migration adds the seven missing values idempotently via ADD VALUE IF NOT EXISTS.
-- =============================================================================

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'class.updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'teacher.created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'teacher.updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'teacher.deactivated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_link.created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_link.updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_link.deactivated';

-- ============================================================
-- 023_installments.sql
-- ============================================================
-- Migration 023: Installment payment support
-- Adds partially_paid order status, tracks cumulative amount paid, and relaxes
-- the UNIQUE(order_id) constraint on payments so each installment gets its own row.

-- 1. New enum value — allows orders to sit between deposit and full payment
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'partially_paid';

-- 2. Track cumulative payments and whether the payer chose an instalment plan
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS amount_paid_cents INTEGER NOT NULL DEFAULT 0
    CONSTRAINT orders_amount_paid_non_negative CHECK (amount_paid_cents >= 0),
  ADD COLUMN IF NOT EXISTS payment_type TEXT NOT NULL DEFAULT 'full'
    CONSTRAINT orders_payment_type_values CHECK (payment_type IN ('full', 'installment'));

-- 3. Drop the old single-payment unique constraint on payments.order_id
ALTER TABLE public.payments
  DROP CONSTRAINT IF EXISTS payments_order_id_key;

-- 4. Add a new constraint: one payment row per (order, Stripe checkout session).
--    This prevents duplicate webhook delivery from inserting the same session twice
--    while allowing multiple instalment rows for the same order.
ALTER TABLE public.payments
  ADD CONSTRAINT payments_order_session_unique
  UNIQUE (order_id, provider_checkout_session_id);

-- ============================================================
-- 024_closed_status.sql
-- ============================================================
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction.
-- These statements commit immediately and are idempotent.

ALTER TYPE public.publication_status ADD VALUE IF NOT EXISTS 'closed';
ALTER TYPE public.audit_action       ADD VALUE IF NOT EXISTS 'activity.closed';

-- ============================================================
-- 025_activity_pupil_eligibility.sql
-- ============================================================
-- FR-ACT-002: individual pupil eligibility for activities.
-- Complements activity_class_eligibility — an activity may be eligible for
-- specific classes, specific pupils, or both.

CREATE TABLE IF NOT EXISTS public.activity_pupil_eligibility (
  activity_id UUID NOT NULL REFERENCES public.activities(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES public.students(id)  ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_id, student_id)
);

ALTER TABLE public.activity_pupil_eligibility ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_ape_activity_id ON public.activity_pupil_eligibility (activity_id);
CREATE INDEX IF NOT EXISTS idx_ape_student_id  ON public.activity_pupil_eligibility (student_id);

-- Public read mirrors activity_class_eligibility policy
CREATE POLICY "public_read_pupil_eligibility"
  ON public.activity_pupil_eligibility FOR SELECT USING (TRUE);

-- Admins can manage pupil eligibility
CREATE POLICY "admins_manage_pupil_eligibility"
  ON public.activity_pupil_eligibility FOR ALL
  USING (public.user_has_permission('activities.create'));

-- Table-level SELECT for anon/authenticated (RLS still filters)
GRANT SELECT ON public.activity_pupil_eligibility TO anon, authenticated;
GRANT ALL    ON public.activity_pupil_eligibility TO service_role;

-- ============================================================
-- 026_deposit_receipt_email_type.sql
-- ============================================================
-- Add deposit_receipt to the email_type enum for installment deposit notifications.
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'deposit_receipt';

-- ============================================================
-- 027_programmes.sql
-- ============================================================
-- =============================================================================
-- Migration 027: Programmes
-- =============================================================================
-- Programmes are recurring weekly sessions (e.g. choir, football, coding club)
-- with a pricing model (per term / month / session), specific days, and term dates.

CREATE TABLE IF NOT EXISTS public.programmes (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id        UUID          NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name             TEXT          NOT NULL,
  description      TEXT,
  price_cents      INTEGER       NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency         TEXT          NOT NULL DEFAULT 'EUR',
  pricing_model    TEXT          NOT NULL DEFAULT 'per_term'
                                 CHECK (pricing_model IN ('per_term', 'per_month', 'per_session')),
  days_of_week     TEXT[]        NOT NULL DEFAULT '{}',
  session_time     TIME,
  term_start       DATE,
  term_end         DATE,
  max_enrolments   INTEGER       CHECK (max_enrolments IS NULL OR max_enrolments > 0),
  publication_status public.publication_status NOT NULL DEFAULT 'draft',
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_by       UUID          REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_programmes_name_not_empty CHECK (trim(name) <> ''),
  CONSTRAINT chk_programmes_term_dates     CHECK (
    term_end IS NULL OR term_start IS NULL OR term_end > term_start
  )
);

CREATE TABLE IF NOT EXISTS public.programme_class_eligibility (
  programme_id UUID NOT NULL REFERENCES public.programmes(id) ON DELETE CASCADE,
  class_id     UUID NOT NULL REFERENCES public.classes(id)    ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (programme_id, class_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_programmes_school_id
  ON public.programmes(school_id);

CREATE INDEX IF NOT EXISTS idx_programmes_publication_status
  ON public.programmes(publication_status);

CREATE INDEX IF NOT EXISTS idx_programme_class_eligibility_programme_id
  ON public.programme_class_eligibility(programme_id);

CREATE INDEX IF NOT EXISTS idx_programme_class_eligibility_class_id
  ON public.programme_class_eligibility(class_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE TRIGGER trg_programmes_updated_at
  BEFORE UPDATE ON public.programmes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.programme_class_eligibility ENABLE ROW LEVEL SECURITY;

-- Authenticated parents/teachers can read published programmes for their school.
-- Admin client (service role) bypasses RLS for all CRUD operations.

CREATE POLICY "authenticated_read_published_programmes"
  ON public.programmes
  FOR SELECT TO authenticated
  USING (
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    AND publication_status = 'published'
    AND is_active = TRUE
  );

CREATE POLICY "authenticated_read_programme_class_eligibility"
  ON public.programme_class_eligibility
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.programmes p
      WHERE p.id = programme_id
        AND p.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ─── Service-role grants ──────────────────────────────────────────────────────

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.programmes TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.programme_class_eligibility TO service_role;

-- ============================================================
-- 028_programme_audit_actions.sql
-- ============================================================
-- =============================================================================
-- Migration 028: Extend audit_action enum with programme action values
-- =============================================================================
-- Programmes Phase A added 'programme.*' AuditAction values to database.ts
-- but never created corresponding PostgreSQL enum values. Without this,
-- every programme create/update/publish/close/archive audit() call silently
-- fails with "invalid input value for enum audit_action". The audit helper
-- catches and logs the error but does not propagate it, so programme writes
-- appear to succeed while audit records are silently dropped.
-- Must run outside a transaction (ALTER TYPE ADD VALUE requires it in PG < 12).

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'programme.created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'programme.updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'programme.published';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'programme.closed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'programme.archived';

-- ============================================================
-- 029_order_items_programme.sql
-- ============================================================
-- =============================================================================
-- Migration 029: Extend order_items to support programme enrolments
-- =============================================================================
-- Phase B of the Programmes module. Makes activity_id nullable and adds a
-- programme_id FK so a single order can contain a mix of activity payments and
-- programme enrolments. A CHECK constraint enforces exactly one item type per row.

-- 1. Make activity columns nullable (all existing rows retain their values)
ALTER TABLE public.order_items ALTER COLUMN activity_id DROP NOT NULL;
ALTER TABLE public.order_items ALTER COLUMN activity_name_snapshot DROP NOT NULL;

-- 2. Add programme columns
ALTER TABLE public.order_items
  ADD COLUMN programme_id UUID REFERENCES public.programmes(id) ON DELETE RESTRICT;

ALTER TABLE public.order_items
  ADD COLUMN programme_name_snapshot TEXT;

-- 3. Exactly one of activity_id / programme_id must be set per row
ALTER TABLE public.order_items
  ADD CONSTRAINT chk_order_items_item_type
  CHECK (
    (activity_id IS NOT NULL AND programme_id IS NULL) OR
    (programme_id IS NOT NULL AND activity_id IS NULL)
  );

-- 4. Index for programme-based queries (attendees page, duplicate detection)
CREATE INDEX idx_order_items_programme_id ON public.order_items(programme_id);

-- 5. Grant SELECT on programme tables to authenticated parents
--    (admin client already has service_role access via migration 027)
GRANT SELECT ON public.programmes TO anon, authenticated;
GRANT SELECT ON public.programme_class_eligibility TO anon, authenticated;

-- ============================================================
-- 030_refund_notice_email_type.sql
-- ============================================================
-- Add refund_notice to the email_type enum for refund confirmation emails (spec §12.1).
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'refund_notice';

-- ============================================================
-- 031_attendance.sql
-- ============================================================
-- Add profile_id to teachers so teachers can be linked to their auth account
ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_teachers_profile_id
  ON public.teachers(profile_id) WHERE profile_id IS NOT NULL;

-- Attendance status enum
CREATE TYPE public.attendance_status AS ENUM ('present', 'absent', 'late');

-- One session per class per date
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  class_id     UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  teacher_id   UUID REFERENCES public.teachers(id) ON DELETE SET NULL,
  session_date DATE NOT NULL,
  notes        TEXT,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school_id, class_id, session_date)
);

-- One record per student per session
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  school_id  UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  status     public.attendance_status NOT NULL DEFAULT 'present',
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_att_sessions_school  ON public.attendance_sessions(school_id);
CREATE INDEX IF NOT EXISTS idx_att_sessions_class   ON public.attendance_sessions(class_id, session_date DESC);
CREATE INDEX IF NOT EXISTS idx_att_sessions_teacher ON public.attendance_sessions(teacher_id);
CREATE INDEX IF NOT EXISTS idx_att_records_session  ON public.attendance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_att_records_student  ON public.attendance_records(student_id);

-- Triggers
CREATE TRIGGER trg_attendance_sessions_updated_at
  BEFORE UPDATE ON public.attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_attendance_records_updated_at
  BEFORE UPDATE ON public.attendance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records  ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "admins_manage_attendance_sessions" ON public.attendance_sessions
  FOR ALL USING (public.is_admin());

CREATE POLICY "admins_manage_attendance_records" ON public.attendance_records
  FOR ALL USING (public.is_admin());

-- Teachers: manage sessions for their own assigned class
CREATE POLICY "teachers_manage_own_sessions" ON public.attendance_sessions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.teachers t
      JOIN public.classes c ON c.teacher_id = t.id
      WHERE t.profile_id = auth.uid()
        AND c.id = attendance_sessions.class_id
        AND t.is_active = TRUE
    )
  );

-- Teachers: manage records in sessions for their class
CREATE POLICY "teachers_manage_own_records" ON public.attendance_records
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.attendance_sessions s
      JOIN public.classes c ON c.id = s.class_id
      JOIN public.teachers t ON t.id = c.teacher_id
      WHERE t.profile_id = auth.uid()
        AND s.id = attendance_records.session_id
        AND t.is_active = TRUE
    )
  );

-- ─── Service-role grants ──────────────────────────────────────────────────────
-- This project has no default privileges configured (see migrations 019–021),
-- so service_role needs explicit grants on every new table. Admin server
-- actions use createSupabaseAdminClient() (service role); without these grants
-- they fail with PostgreSQL error 42501 (permission denied).

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.attendance_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.attendance_records TO service_role;

-- ============================================================
-- 032_attendance_service_role_grants.sql
-- ============================================================
-- =============================================================================
-- Migration 032: Service-role grants for attendance tables
-- =============================================================================
-- Migration 031 created attendance_sessions and attendance_records but did not
-- grant table privileges to service_role. This project has NO default
-- privileges configured (see migrations 019–021), so every table needs
-- explicit grants. Without them, the admin client (service role) fails with
-- PostgreSQL error 42501 (permission denied) on both reads and writes —
-- which manifested as "Failed to create session" in the teacher portal and
-- "0 sessions" on the dashboard.
--
-- These grants are idempotent and safe to re-run.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.attendance_sessions TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.attendance_records TO service_role;

-- ============================================================
-- 033_school_subdomain.sql
-- ============================================================
-- =============================================================================
-- Migration 033: Multi-tenant — school subdomain for tenant resolution
-- =============================================================================
-- Adds a `subdomain` to schools so a request's host (e.g. stmarys.example.ie)
-- can be mapped to the correct school. This is the first step of multi-tenant
-- support; public pages resolve the tenant from the host, falling back to the
-- configured default school when no subdomain is present (single-tenant safe).
--
-- schools already has SELECT grants for anon/authenticated (migration 021) and
-- DML for service_role (migration 020), so no new grants are required.

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS subdomain TEXT;

-- Unique per tenant (nullable until a school is assigned one)
CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_subdomain
  ON public.schools(subdomain) WHERE subdomain IS NOT NULL;

-- Backfill the existing demo school
UPDATE public.schools
SET subdomain = 'scoildemo'
WHERE id = '00000000-0000-0000-0000-000000000001'
  AND subdomain IS NULL;

-- ============================================================
-- 034_rls_grants_and_school_scope_helper.sql
-- ============================================================
-- =============================================================================
-- Migration 034: RLS hardening, slice 1 — authenticated SELECT grants + helper
-- =============================================================================
-- Part of multi-tenant Step 2. This slice is ADDITIVE and SAFE:
--   * Granting SELECT to `authenticated` does NOT expose data — RLS policies
--     still gate every row. Without the grant, RLS is never reached (42501).
--   * The new helper is not yet referenced by any policy (slice 2 will use it).
--
-- IMPORTANT (see docs/implementation-status.md): the EXISTING admin RLS policies
-- are NOT school-scoped (they use user_has_permission() with no school_id check).
-- Reads must NOT be switched to the RLS client until slice 2 rewrites those
-- policies to be school-scoped using is_admin_of_school() below.

-- ─── authenticated SELECT grants for tenant tables missing them ───────────────
-- (migration 021 granted the others; these were created later or omitted)
GRANT SELECT ON public.students                     TO authenticated;
GRANT SELECT ON public.programmes                   TO authenticated;
GRANT SELECT ON public.programme_class_eligibility  TO authenticated;
GRANT SELECT ON public.attendance_sessions          TO authenticated;
GRANT SELECT ON public.attendance_records           TO authenticated;
GRANT SELECT ON public.refunds                      TO authenticated;
GRANT SELECT ON public.email_notifications          TO authenticated;
GRANT SELECT ON public.webhook_events               TO authenticated;
GRANT SELECT ON public.audit_logs                   TO authenticated;

-- ─── School-scoped admin helper (used by slice 2 policies) ────────────────────
-- True when the current user holds an admin role *for the given school*.
-- SECURITY DEFINER so it can read user_roles regardless of that table's RLS.
CREATE OR REPLACE FUNCTION public.is_admin_of_school(p_school_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.id = ur.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.school_id = p_school_id
      AND r.name IN ('super_admin', 'school_admin', 'finance_admin')
  );
$$;

-- ============================================================
-- 035_school_scoped_admin_policies.sql
-- ============================================================
-- =============================================================================
-- Migration 035: RLS hardening, slice 2 — school-scoped admin policies
-- =============================================================================
-- Rewrites the admin RLS policies (migrations 010/012/014/025/031) which were
-- NOT school-scoped (they used user_has_permission()/is_admin() with no
-- school_id check) into versions scoped with is_admin_of_school(school_id)
-- (migration 034). After this an admin only sees/manages rows in their OWN
-- school via the RLS client.
--
-- SAFE TO APPLY NOW: the running app reads/writes via the service-role client,
-- which BYPASSES RLS — so these policy changes do not alter current behaviour.
-- They take effect when reads switch to the RLS client (slice 3), and provide
-- defence-in-depth immediately.
--
-- Tables with a direct school_id use is_admin_of_school(school_id).
-- Child tables (no school_id) scope via their parent (orders / activities).
-- programmes + programme_class_eligibility (migration 027) are already
-- school-scoped and are left unchanged. webhook_events has no school_id
-- (global Stripe events) and is left as an admin-only operational table.

-- ─── schools / school_settings / profiles ────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_school" ON public.schools;
CREATE POLICY "admins_read_school" ON public.schools
  FOR SELECT USING (public.is_admin_of_school(id));

DROP POLICY IF EXISTS "admins_read_school_settings" ON public.school_settings;
CREATE POLICY "admins_read_school_settings" ON public.school_settings
  FOR SELECT USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_read_profiles" ON public.profiles;
CREATE POLICY "admins_read_profiles" ON public.profiles
  FOR SELECT USING (school_id IS NOT NULL AND public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_profiles" ON public.profiles;
CREATE POLICY "admins_manage_profiles" ON public.profiles
  FOR ALL USING (school_id IS NOT NULL AND public.is_admin_of_school(school_id));

-- ─── classes / students ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_manage_classes" ON public.classes;
CREATE POLICY "admins_manage_classes" ON public.classes
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_students" ON public.students;
CREATE POLICY "admins_manage_students" ON public.students
  FOR ALL USING (public.is_admin_of_school(school_id));

-- Teacher read of students: keep the permission check but scope to the
-- teacher's own school (was unscoped — could leak cross-school).
DROP POLICY IF EXISTS "teachers_read_class_students" ON public.students;
CREATE POLICY "teachers_read_class_students" ON public.students
  FOR SELECT USING (
    public.user_has_permission('students.view_class')
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

-- ─── parent links ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_manage_parent_links" ON public.parent_student_links;
CREATE POLICY "admins_manage_parent_links" ON public.parent_student_links
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_link_requests" ON public.parent_link_requests;
CREATE POLICY "admins_manage_link_requests" ON public.parent_link_requests
  FOR ALL USING (public.is_admin_of_school(school_id));

-- ─── activities + eligibility ────────────────────────────────────────────────
DROP POLICY IF EXISTS "admins_read_all_activities" ON public.activities;
CREATE POLICY "admins_read_all_activities" ON public.activities
  FOR SELECT USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_activities" ON public.activities;
CREATE POLICY "admins_manage_activities" ON public.activities
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_eligibility" ON public.activity_class_eligibility;
CREATE POLICY "admins_manage_eligibility" ON public.activity_class_eligibility
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_class_eligibility.activity_id
        AND public.is_admin_of_school(a.school_id)
    )
  );

DROP POLICY IF EXISTS "admins_manage_pupil_eligibility" ON public.activity_pupil_eligibility;
CREATE POLICY "admins_manage_pupil_eligibility" ON public.activity_pupil_eligibility
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.activities a
      WHERE a.id = activity_pupil_eligibility.activity_id
        AND public.is_admin_of_school(a.school_id)
    )
  );

-- ─── orders + child tables (order_items / payments / refunds / emails) ────────
DROP POLICY IF EXISTS "admins_read_all_orders" ON public.orders;
CREATE POLICY "admins_read_all_orders" ON public.orders
  FOR SELECT USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_update_orders" ON public.orders;
CREATE POLICY "admins_update_orders" ON public.orders
  FOR UPDATE USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_read_all_order_items" ON public.order_items;
CREATE POLICY "admins_read_all_order_items" ON public.order_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_manage_order_items" ON public.order_items;
CREATE POLICY "admins_manage_order_items" ON public.order_items
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_read_all_payments" ON public.payments;
CREATE POLICY "admins_read_all_payments" ON public.payments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_manage_payments" ON public.payments;
CREATE POLICY "admins_manage_payments" ON public.payments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_read_all_refunds" ON public.refunds;
CREATE POLICY "admins_read_all_refunds" ON public.refunds
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_manage_refunds" ON public.refunds;
CREATE POLICY "admins_manage_refunds" ON public.refunds
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id AND public.is_admin_of_school(o.school_id))
  );

DROP POLICY IF EXISTS "admins_manage_email_notifs" ON public.email_notifications;
CREATE POLICY "admins_manage_email_notifs" ON public.email_notifications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = email_notifications.order_id AND public.is_admin_of_school(o.school_id))
  );

-- ─── teachers / payment_links / attendance / audit_logs ──────────────────────
DROP POLICY IF EXISTS "admins_manage_teachers" ON public.teachers;
CREATE POLICY "admins_manage_teachers" ON public.teachers
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_payment_links" ON public.payment_links;
CREATE POLICY "admins_manage_payment_links" ON public.payment_links
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_attendance_sessions" ON public.attendance_sessions;
CREATE POLICY "admins_manage_attendance_sessions" ON public.attendance_sessions
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_manage_attendance_records" ON public.attendance_records;
CREATE POLICY "admins_manage_attendance_records" ON public.attendance_records
  FOR ALL USING (public.is_admin_of_school(school_id));

DROP POLICY IF EXISTS "admins_read_audit_logs" ON public.audit_logs;
CREATE POLICY "admins_read_audit_logs" ON public.audit_logs
  FOR SELECT USING (school_id IS NOT NULL AND public.is_admin_of_school(school_id));

-- ============================================================
-- 036_profiles_must_change_password.sql
-- ============================================================
-- =============================================================================
-- Migration 036: profiles.must_change_password — force first-login password change
-- =============================================================================
-- Set TRUE when a login is provisioned with a temporary password (e.g. teacher
-- invites). Protected route-group guards redirect such users to /change-password
-- until they set their own password, which clears the flag.
--
-- Additive and safe: defaults FALSE so existing users are unaffected. No new
-- grants (service_role already has DML on profiles; authenticated has SELECT).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 037_pupil_code_school_prefix.sql
-- ============================================================
-- 037: Per-school pupil payment code prefix
--
-- Previously generate_pupil_code() hard-coded the "SB-" prefix (a Scoil Bhríde
-- legacy), so every tenant's pupil codes looked like another school's. This
-- parameterises the prefix so each school's codes reflect its own name
-- (e.g. "SPP-…" for St Peters Primary School). The prefix is sanitised here as a
-- defence-in-depth measure even though callers pass a clean value.
--
-- The DEFAULT keeps existing call sites working and preserves "SB" as the
-- fallback for any caller that omits the argument.

-- Drop the old zero-argument version so the defaulted one isn't ambiguous.
DROP FUNCTION IF EXISTS public.generate_pupil_code();

CREATE OR REPLACE FUNCTION public.generate_pupil_code(p_prefix TEXT DEFAULT 'SB')
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_chars  TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- omit I, O, 0, 1
  v_prefix TEXT;
  v_code   TEXT;
  v_i      INTEGER;
BEGIN
  -- Sanitise: uppercase, alphanumeric only, 2–4 chars; fall back to 'SB'.
  v_prefix := upper(regexp_replace(COALESCE(p_prefix, ''), '[^A-Za-z0-9]', '', 'g'));
  v_prefix := substr(v_prefix, 1, 4);
  IF length(v_prefix) < 2 THEN
    v_prefix := 'SB';
  END IF;

  v_code := v_prefix || '-';
  FOR v_i IN 1..8 LOOP
    v_code := v_code || substr(v_chars, floor(random() * length(v_chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN v_code;
END;
$$;

-- ============================================================
-- 038_subscriptions.sql
-- ============================================================
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

-- ============================================================
-- 039_drop_redundant_subscription_index.sql
-- ============================================================
-- =============================================================================
-- Migration 039: Drop redundant index on subscriptions.school_id
-- =============================================================================
-- Phase 1 review finding: migration 038 added both `UNIQUE (school_id)` and a
-- separate `idx_subscriptions_school_id`. The UNIQUE constraint already creates a
-- unique B-tree index on school_id, so the extra index is fully redundant (it only
-- adds write/storage overhead). Drop it. The unique constraint's own index remains
-- and serves all school_id lookups.
DROP INDEX IF EXISTS public.idx_subscriptions_school_id;

-- ============================================================
-- 040_subscriptions_service_role_grants.sql
-- ============================================================
-- =============================================================================
-- Migration 040: Service-role grants for the subscriptions table
-- =============================================================================
-- Migration 038 created public.subscriptions and granted SELECT to `authenticated`,
-- but did NOT grant table privileges to `service_role`. This project has NO default
-- privileges configured (see migrations 019–021, 032), so every table needs explicit
-- grants. Without them, the admin client (service role) fails with PostgreSQL error
-- 42501 (permission denied for table subscriptions) on reads and writes — which
-- manifested as: subscription webhooks failing (customer.subscription.* and
-- invoice.payment_* recorded in webhook_events with error "permission denied for
-- table subscriptions"), the checkout pre-insert silently failing, and
-- /admin/subscription always showing "Free".
--
-- Idempotent and safe to re-run.

GRANT USAGE ON SCHEMA public TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.subscriptions TO service_role;

-- ============================================================
-- 041_subscription_email_types.sql
-- ============================================================
-- Subscription/dunning email types so subscription lifecycle emails can be logged
-- in email_notifications alongside order emails (see migration 042 for the columns).
-- Kept in its own migration: ALTER TYPE ... ADD VALUE must commit before the new
-- values can be referenced, so it is isolated from the table changes that follow.
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'subscription_payment_failed';
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'subscription_ended';

-- ============================================================
-- 042_email_notifications_subscription_columns.sql
-- ============================================================
-- Subscription emails (dunning, ended) have no order — relax order_id and add a
-- nullable school_id so they can be recorded per tenant in email_notifications.
ALTER TABLE public.email_notifications
  ALTER COLUMN order_id DROP NOT NULL;

ALTER TABLE public.email_notifications
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_email_notifs_school_id
  ON public.email_notifications(school_id);

-- Integrity: every notification must reference an order OR a school (never neither).
ALTER TABLE public.email_notifications
  DROP CONSTRAINT IF EXISTS email_notifications_order_or_school;
ALTER TABLE public.email_notifications
  ADD CONSTRAINT email_notifications_order_or_school
  CHECK (order_id IS NOT NULL OR school_id IS NOT NULL);

-- email_notifications already grants service_role DML + authenticated SELECT
-- (migrations 019/020/034); the new column inherits those table-level grants.

-- ============================================================
-- 043_parent_messages.sql
-- ============================================================
-- =============================================================================
-- Migration 043: Parent messaging email type — feature #1, Phase 1
-- =============================================================================
-- New email_type value for direct teacher/admin → parent messages. Kept in its
-- OWN migration: ALTER TYPE ... ADD VALUE must commit before the value can be
-- referenced, and combining it with other DDL in one Supabase SQL-editor run
-- (a single transaction) fails. The table + RLS live in migration 044.
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'parent_message';

-- ============================================================
-- 044_parent_messages_table.sql
-- ============================================================
-- =============================================================================
-- Migration 044: Parent messaging audit table — feature #1, Phase 1
-- =============================================================================
-- Each composed message is recorded once in parent_messages (audit), and each
-- recipient send is recorded in email_notifications (order_id NULL + school_id,
-- type 'parent_message' from migration 043). Recipients are resolved server-side
-- from IDs; teachers are restricted to parents of pupils in their OWN classes
-- (enforced in the server action, not here).
--
-- Run AFTER migration 043 (the enum value).
--
-- RLS note: all reads in the app go through the service-role admin client
-- (createSupabaseAdminClient), which bypasses RLS — the /admin/messages and
-- /teacher/messages pages both use it. So no authenticated-read policy is
-- required for the feature. We still ENABLE RLS (deny-by-default for anon /
-- authenticated) and add a self-contained "sender reads own" policy as
-- defence-in-depth. We deliberately do NOT use the is_admin_of_school() helper
-- here: it is not present in this database, and admin reads don't need it.

CREATE TABLE public.parent_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id       UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  sender_id       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  sender_role     TEXT NOT NULL CHECK (sender_role IN ('admin', 'teacher')),
  audience_type   TEXT NOT NULL CHECK (audience_type IN ('class', 'student', 'school')),
  class_id        UUID REFERENCES public.classes(id) ON DELETE SET NULL,
  student_id      UUID REFERENCES public.students(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parent_messages_school_id ON public.parent_messages(school_id, created_at DESC);
CREATE INDEX idx_parent_messages_sender_id ON public.parent_messages(sender_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.parent_messages ENABLE ROW LEVEL SECURITY;

-- A sender may read their own messages (self-contained, no helper function).
-- Writes are service-role only (the send action), so no write policy is granted.
-- Admin history reads use the service-role client, which bypasses RLS.
CREATE POLICY "senders_read_own_messages" ON public.parent_messages
  FOR SELECT USING (sender_id = auth.uid());

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.parent_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_messages TO service_role;

-- ============================================================
-- 045_parent_message_recipients.sql
-- ============================================================
-- =============================================================================
-- Migration 045: Parent message in-app inbox — feature #1, Phase 4
-- =============================================================================
-- Per-recipient delivery records so each parent has an in-app inbox in the parent
-- portal (in addition to the email they already receive). One row per
-- (message, parent); read_at tracks read/unread. The send action writes one row
-- per resolved recipient alongside the email.
--
-- No ALTER TYPE here, so it is safe to run as a single transaction.
--
-- RLS note: parent portal pages read via the service-role admin client scoped to
-- the logged-in user's id (auth.uid() is null in Server Components, so an
-- auth.uid()-based policy would return 0 rows — same pattern as orders). The RLS
-- policy below is defence-in-depth; the actual read path is service-role + a
-- manual parent_id filter.

CREATE TABLE public.parent_message_recipients (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id  UUID NOT NULL REFERENCES public.parent_messages(id) ON DELETE CASCADE,
  parent_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  school_id   UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A parent gets at most one inbox row per message.
  UNIQUE (message_id, parent_id)
);

CREATE INDEX idx_pmr_parent ON public.parent_message_recipients(parent_id, created_at DESC);
CREATE INDEX idx_pmr_message ON public.parent_message_recipients(message_id);

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.parent_message_recipients ENABLE ROW LEVEL SECURITY;

-- A parent may read their own inbox rows (defence-in-depth; reads actually go
-- through the service-role client scoped to the user id). Writes are
-- service-role only (the send + mark-read actions).
CREATE POLICY "parents_read_own_inbox" ON public.parent_message_recipients
  FOR SELECT USING (parent_id = auth.uid());

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.parent_message_recipients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_message_recipients TO service_role;

-- ============================================================
-- 046_time_off_requests.sql
-- ============================================================
-- =============================================================================
-- Migration 046: Teacher time-off requests
-- =============================================================================
-- Teachers submit time-off requests; admins approve or reject them. Status uses
-- TEXT + CHECK (not an enum) to avoid the ALTER TYPE-in-transaction gotcha.
-- Reads go through the service-role admin client scoped by teacher_id/school_id
-- (same pattern as the rest of the teacher/admin portal), so RLS is enabled as
-- defence-in-depth and no authenticated policy / is_admin_of_school() is used.

CREATE TABLE public.time_off_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  reason       TEXT,
  status       TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at  TIMESTAMPTZ,
  review_note  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT time_off_dates_ordered CHECK (end_date >= start_date)
);

CREATE INDEX idx_time_off_school  ON public.time_off_requests(school_id, status, created_at DESC);
CREATE INDEX idx_time_off_teacher ON public.time_off_requests(teacher_id, created_at DESC);

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_time_off_updated_at
  BEFORE UPDATE ON public.time_off_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.time_off_requests ENABLE ROW LEVEL SECURITY;

-- Writes + reads are performed by the service-role admin client (server actions +
-- pages scoped manually by teacher_id/school_id). No authenticated policy is
-- required; RLS-on with no policy denies direct anon/authenticated access.

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.time_off_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.time_off_requests TO service_role;

-- ============================================================
-- 047_time_off_enum_values.sql
-- ============================================================
-- =============================================================================
-- Migration 047: enum values for time-off notifications + audit
-- =============================================================================
-- Adds the email_type + audit_action values used by the time-off follow-up
-- (admin/teacher email notifications and audit-log entries). Enum-only migration
-- (no table DDL) — ALTER TYPE ... ADD VALUE must commit before the values can be
-- referenced, and the app uses them at runtime, so they are isolated here.

ALTER TYPE public.email_type   ADD VALUE IF NOT EXISTS 'time_off_requested';
ALTER TYPE public.email_type   ADD VALUE IF NOT EXISTS 'time_off_reviewed';

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'time_off.requested';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'time_off.approved';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'time_off.rejected';

-- ============================================================
-- 048_meeting_slots.sql
-- ============================================================
-- =============================================================================
-- Migration 048: Parent–teacher meeting slots
-- =============================================================================
-- Teachers publish availability as DISCRETE slot rows (generated server-side
-- from an availability block). A booking lives on the slot row itself
-- (booked_parent_id / booked_student_id / booked_at — all NULL = free), and is
-- claimed with an atomic conditional UPDATE (... WHERE booked_parent_id IS NULL),
-- which makes double-booking impossible without locks.
--
-- Times are WALL-CLOCK (DATE + TIME, not timestamptz): teachers and parents of
-- one school share a timezone, so wall-clock storage sidesteps UTC/server-tz
-- conversion bugs entirely.
--
-- Reads/writes go through the service-role admin client scoped by
-- teacher_id / school_id / parent id (portal-wide pattern). RLS is enabled as
-- deny-by-default defence-in-depth; no is_admin_of_school() (absent in prod).

CREATE TABLE public.meeting_slots (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id         UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id        UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  slot_date         DATE NOT NULL,
  start_time        TIME NOT NULL,
  end_time          TIME NOT NULL,
  booked_parent_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  booked_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  booked_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT meeting_slot_times_ordered CHECK (end_time > start_time),
  -- Prevents duplicate slot generation for the same teacher/date/time.
  CONSTRAINT meeting_slot_unique UNIQUE (teacher_id, slot_date, start_time)
);

CREATE INDEX idx_meeting_slots_teacher ON public.meeting_slots(teacher_id, slot_date, start_time);
CREATE INDEX idx_meeting_slots_parent
  ON public.meeting_slots(booked_parent_id)
  WHERE booked_parent_id IS NOT NULL;

-- Reuse the shared updated-at trigger helper (migration 003).
CREATE TRIGGER trg_meeting_slots_updated_at
  BEFORE UPDATE ON public.meeting_slots
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ────────────────────────────────────────────────────────────────────
ALTER TABLE public.meeting_slots ENABLE ROW LEVEL SECURITY;
-- No anon/authenticated policies: RLS-on with no policy denies direct access;
-- the app reads/writes via the service-role client with explicit scoping.

-- ─── Grants (this project has NO default privileges — see migrations 019–021) ──
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.meeting_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_slots TO service_role;

-- ============================================================
-- 049_meeting_email_types.sql
-- ============================================================
-- =============================================================================
-- Migration 049: enum values for meeting-booking notifications
-- =============================================================================
-- Enum-only migration (no table DDL) — ALTER TYPE ... ADD VALUE must commit
-- before the values can be referenced, so they are isolated here. Used by the
-- booking/cancellation emails logged to email_notifications.

ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'meeting_booked';
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'meeting_cancelled';

-- ============================================================
-- 050_meeting_slots_class.sql
-- ============================================================
-- =============================================================================
-- Migration 050: class-targeted meeting slots
-- =============================================================================
-- A teacher with multiple classes can publish availability for ONE class, so
-- only that class's parents can see/book those slots. NULL class_id keeps the
-- original meaning: open to parents of all the teacher's classes (existing
-- rows are unaffected).
--
-- ⚠️ Apply to the REAL production project: jywkpenzhzzptsrntobf
--    ("PrimarySchoolPortal") — NOT "Primary School Mgt Sys".

ALTER TABLE public.meeting_slots
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

-- ============================================================
-- 051_revolut_provider_enum.sql
-- ============================================================
-- =============================================================================
-- Migration 051: add 'revolut' to the payment_provider enum
-- =============================================================================
-- Enum-only, in its own file: combining ALTER TYPE ... ADD VALUE with other DDL
-- in a single Supabase SQL-editor transaction fails. Run this before 052.
--
-- ⚠️ Apply to the REAL production project: jywkpenzhzzptsrntobf
--    ("PrimarySchoolPortal") — verify the ref in the dashboard URL first.

ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'revolut';

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
