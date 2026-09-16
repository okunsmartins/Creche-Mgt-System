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

-- Pupil payment code: <PREFIX>-XXXXXXXX (per-school prefix + 8 random chars).
-- Collision-safe: caller retries if duplicate is detected (extremely rare).
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
-- =============================================================================
-- Migration 014: Payment links
-- =============================================================================
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
                           DEFAULT encode(gen_random_bytes(32), 'hex'),
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
-- =============================================================================
-- Migration 015: Add teacher_name_snapshot to order_items
-- =============================================================================
-- Nullable because orders created before teacher assignment (or for activities
-- without an assigned teacher) carry no teacher snapshot.
-- The snapshot is locked at order creation — subsequent teacher renames do
-- not affect historical records.

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS teacher_name_snapshot TEXT;
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
-- =============================================================================
-- Migration 018: Add display_name to teachers; add opens_at, visit_count,
--                completed_order_count to payment_links
-- =============================================================================
-- display_name is the short name shown in payment references, e.g. "Ms Kelly".
-- Defaults to first_name || ' ' || last_name if not set.

ALTER TABLE public.teachers
  ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Back-fill display_name from existing first_name + last_name for the seed rows
UPDATE public.teachers SET display_name = first_name || ' ' || last_name WHERE display_name IS NULL;

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
-- =============================================================================
-- Scoil Bhríde Payment Portal — Fictional Seed Data
-- =============================================================================
-- ALL DATA IS FICTIONAL. No real pupil, parent or staff information is used.
-- This seed is for development and demonstration purposes only.
--
-- IMPORTANT: The super administrator account must be created separately through
-- the Supabase Auth dashboard or CLI. See docs/deployment.md for instructions.
-- Do NOT commit real email addresses or passwords to source control.
-- =============================================================================

-- ─── School ──────────────────────────────────────────────────────────────────

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

-- ─── School settings ─────────────────────────────────────────────────────────

INSERT INTO public.school_settings (school_id, key, value, description)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'notification_email', 'office@scoilbhride.example.ie', 'General school notification email address'),
  ('00000000-0000-0000-0000-000000000001', 'portal_name', 'Scoil Bhríde Payment Portal', 'Display name for the portal'),
  ('00000000-0000-0000-0000-000000000001', 'currency', 'EUR', 'Payment currency'),
  ('00000000-0000-0000-0000-000000000001', 'stripe_mode', 'test', 'Stripe environment: test or live'),
  ('00000000-0000-0000-0000-000000000001', 'data_retention_months', '84', 'Data retention period in months (7 years default)')
ON CONFLICT (school_id, key) DO NOTHING;

-- ─── Classes (8 required Irish primary school classes) ────────────────────────

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

-- ─── Fictional students (20 across all classes) ───────────────────────────────
-- Pupil payment codes pre-generated for predictable testing.

INSERT INTO public.students (id, school_id, first_name, last_name, class_id, pupil_payment_code)
VALUES
  -- Junior Infants (3)
  -- Codes use only: A-H J-N P-Z 2-9  (no I O 0 1 — see generate_pupil_code() in migration 002)
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Aoife',    'Murphy',    '10000000-0000-0000-0000-000000000001', 'SB-AM224567'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Ciarán',   'O''Brien',  '10000000-0000-0000-0000-000000000001', 'SB-CB334567'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Siobhán',  'Kelly',     '10000000-0000-0000-0000-000000000001', 'SB-SK445678'),
  -- Senior Infants (2)
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Darragh',  'Walsh',     '10000000-0000-0000-0000-000000000002', 'SB-DW556789'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Niamh',    'Ryan',      '10000000-0000-0000-0000-000000000002', 'SB-NR667892'),
  -- First Class (3)
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Conor',    'Brennan',   '10000000-0000-0000-0000-000000000003', 'SB-CB778923'),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Éabha',    'Doyle',     '10000000-0000-0000-0000-000000000003', 'SB-ED889234'),
  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Tadhg',    'Fitzgerald','10000000-0000-0000-0000-000000000003', 'SB-TF992345'),
  -- Second Class (2)
  ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 'Clodagh',  'McCarthy',  '10000000-0000-0000-0000-000000000004', 'SB-CM223456'),
  ('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 'Fionn',    'O''Connor', '10000000-0000-0000-0000-000000000004', 'SB-FC334567'),
  -- Third Class (2)
  ('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Grainne',  'Quinn',     '10000000-0000-0000-0000-000000000005', 'SB-GQ445678'),
  ('20000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Seán',     'Burke',     '10000000-0000-0000-0000-000000000005', 'SB-SB556789'),
  -- Fourth Class (3)
  ('20000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Roisín',   'Collins',   '10000000-0000-0000-0000-000000000006', 'SB-RC667892'),
  ('20000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001', 'Oisín',    'Dempsey',   '10000000-0000-0000-0000-000000000006', 'SB-PD778923'),
  ('20000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001', 'Caoimhe',  'Farrell',   '10000000-0000-0000-0000-000000000006', 'SB-CF889234'),
  -- Fifth Class (3)
  ('20000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000001', 'Cillian',  'Hayes',     '10000000-0000-0000-0000-000000000007', 'SB-KH992345'),
  ('20000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000001', 'Saoirse',  'Lynch',     '10000000-0000-0000-0000-000000000007', 'SB-SL223467'),
  ('20000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000001', 'Cathal',   'Nolan',     '10000000-0000-0000-0000-000000000007', 'SB-CN334568'),
  -- Sixth Class (2)
  ('20000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000001', 'Áine',     'Power',     '10000000-0000-0000-0000-000000000008', 'SB-AP445679'),
  ('20000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000001', 'Cormac',   'Sheridan',  '10000000-0000-0000-0000-000000000008', 'SB-CS556782')
ON CONFLICT (id) DO NOTHING;

-- ─── Activities ───────────────────────────────────────────────────────────────

INSERT INTO public.activities (id, school_id, name, description, amount_cents, accounting_code, opens_at, closes_at, publication_status, is_active)
VALUES
  -- 1. Active: school trip for all classes
  (
    '30000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    'Dublin Zoo School Trip',
    'Annual trip to Dublin Zoo. Includes coach transport and entry fee. Please pay by the closing date.',
    2500,    -- €25.00
    'TRIPS-2025',
    NOW() - INTERVAL '7 days',
    NOW() + INTERVAL '21 days',
    'published',
    TRUE
  ),
  -- 2. Active: adventure trip for 5th and 6th class
  (
    '30000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000001',
    'Zipit Adventure Trip',
    'Two-hour outdoor adventure activity at Zipit Forest Adventures. Suitable for 5th and 6th class.',
    3500,    -- €35.00
    'TRIPS-2025',
    NOW() - INTERVAL '3 days',
    NOW() + INTERVAL '14 days',
    'published',
    TRUE
  ),
  -- 3. Active: book rental for all classes
  (
    '30000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000001',
    'Book Rental Scheme 2025–2026',
    'Annual book rental contribution covering core curriculum books.',
    7500,    -- €75.00
    'BOOKS-2025',
    NOW() - INTERVAL '14 days',
    NOW() + INTERVAL '60 days',
    'published',
    TRUE
  ),
  -- 4. Active: school uniform (all classes)
  (
    '30000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000001',
    'School Uniform Order',
    'Order school jumpers, tracksuit tops and PE T-shirts through the portal.',
    4000,    -- €40.00
    'UNIFORM-2025',
    NOW() - INTERVAL '7 days',
    NOW() + INTERVAL '30 days',
    'published',
    TRUE
  ),
  -- 5. Future: not yet open
  (
    '30000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000001',
    'Christmas Pantomime 2025',
    'Visit to the Gaiety Theatre for the annual Christmas pantomime. Places are limited.',
    1500,    -- €15.00
    'TRIPS-2025',
    NOW() + INTERVAL '30 days',
    NOW() + INTERVAL '60 days',
    'published',
    TRUE
  ),
  -- 6. Closed: past closing date
  (
    '30000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000001',
    'Science Week Workshop',
    'Interactive science workshop delivered by ScienceXplosion. Now closed.',
    800,     -- €8.00
    'EVENTS-2025',
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '10 days',
    'published',
    TRUE
  ),
  -- 7. Unpublished / draft
  (
    '30000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000001',
    'Spring Sports Day — DRAFT',
    'Sports day contribution for equipment and prizes. Not yet published.',
    500,     -- €5.00
    'EVENTS-2026',
    NULL,
    NULL,
    'draft',
    TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ─── Activity class eligibility ───────────────────────────────────────────────

-- Dublin Zoo: all 8 classes
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
SELECT '30000000-0000-0000-0000-000000000001', id FROM public.classes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Zipit Adventure: 5th and 6th class only
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
VALUES
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000007'),
  ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000008')
ON CONFLICT DO NOTHING;

-- Book Rental: all 8 classes
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
SELECT '30000000-0000-0000-0000-000000000003', id FROM public.classes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Uniform: all 8 classes
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
SELECT '30000000-0000-0000-0000-000000000004', id FROM public.classes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Christmas Panto: all 8 classes
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
SELECT '30000000-0000-0000-0000-000000000005', id FROM public.classes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- Science Week: 3rd, 4th, 5th class
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
VALUES
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000005'),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000006'),
  ('30000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000007')
ON CONFLICT DO NOTHING;

-- Sports Day: all classes
INSERT INTO public.activity_class_eligibility (activity_id, class_id)
SELECT '30000000-0000-0000-0000-000000000007', id FROM public.classes
WHERE school_id = '00000000-0000-0000-0000-000000000001'
ON CONFLICT DO NOTHING;

-- =============================================================================
-- Administrator Account Setup
-- =============================================================================
-- The super administrator account is NOT seeded here for security reasons.
-- Create it securely using one of the following methods:
--
-- Option A — Supabase Dashboard:
--   1. Go to Authentication → Users → Invite user
--   2. Use email: admin@scoilbhride.example.ie (or your own)
--   3. After the user sets a password, run the SQL below to assign the role:
--
-- Option B — Supabase CLI:
--   supabase auth create-user --email admin@scoilbhride.example.ie
--   (Set a strong password interactively — never commit passwords)
--
-- After creating the auth user, run this SQL (replacing the UUID):
-- =============================================================================
--
-- INSERT INTO public.user_roles (user_id, role_id, school_id, granted_by)
-- SELECT
--   '<auth-user-uuid>',
--   r.id,
--   '00000000-0000-0000-0000-000000000001',
--   '<auth-user-uuid>'
-- FROM public.roles r
-- WHERE r.name = 'super_admin';
--
-- =============================================================================
-- Fictional parent profiles are also created through Auth registration.
-- After registration, link them to students using:
--
-- INSERT INTO public.parent_student_links (parent_id, student_id, school_id, relationship)
-- VALUES ('<parent-uuid>', '<student-uuid>', '00000000-0000-0000-0000-000000000001', 'parent');
-- =============================================================================
-- =============================================================================
-- Migration 017: Seed fictional teachers and assign to classes
-- =============================================================================
-- ALL DATA IS FICTIONAL.  No real staff information is used.

-- ─── Fictional teachers ───────────────────────────────────────────────────────

INSERT INTO public.teachers (id, school_id, first_name, last_name, display_name, email, is_active)
VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'Máire',    'Ní Bhriain',       'Ms Ní Bhriain',       'mbriain@scoilbhride.example.ie',       TRUE),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'Seán',     'Ó Dochartaigh',    'Mr Ó Dochartaigh',    'sodochartaigh@scoilbhride.example.ie', TRUE),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'Caoimhe',  'Mhic Gearailt',    'Ms Mhic Gearailt',    'cmhicgearailt@scoilbhride.example.ie', TRUE),
  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'Pádraig',  'Ó Maolalaidh',     'Mr Ó Maolalaidh',     'pomaolalaidh@scoilbhride.example.ie',  TRUE),
  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'Bríd',     'Uí Cheallaigh',    'Ms Uí Cheallaigh',    'buiceallaigh@scoilbhride.example.ie',  TRUE),
  ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'Tomás',    'Mac Cormaic',      'Mr Mac Cormaic',      'tmaccormaic@scoilbhride.example.ie',   TRUE),
  ('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 'Aoife',    'Ní Shúilleabháin', 'Ms Ní Shúilleabháin', 'anishuilleabhain@scoilbhride.example.ie', TRUE),
  ('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 'Ciarán',   'Ó Briain',         'Mr Ó Briain',         'cobriain@scoilbhride.example.ie',      TRUE)
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

-- =============================================================================
-- Migration 019: Service-role ALL grants
-- =============================================================================
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

-- =============================================================================
-- Migration 020: Service-role DML grants (supplement to migration 019)
-- =============================================================================
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

-- =============================================================================
-- Migration 021: anon / authenticated SELECT grants
-- =============================================================================
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

-- Public / anon-readable tables
GRANT SELECT ON public.activities                 TO anon, authenticated;
GRANT SELECT ON public.activity_class_eligibility TO anon, authenticated;
GRANT SELECT ON public.classes                    TO anon, authenticated;
GRANT SELECT ON public.schools                    TO anon, authenticated;
GRANT SELECT ON public.school_settings            TO anon, authenticated;
GRANT SELECT ON public.payment_links              TO anon, authenticated;
GRANT SELECT ON public.teachers                   TO anon, authenticated;

-- Authenticated-only tables
GRANT SELECT ON public.parent_student_links       TO authenticated;
GRANT SELECT ON public.parent_link_requests       TO authenticated;
GRANT SELECT ON public.orders                     TO authenticated;
GRANT SELECT ON public.order_items                TO authenticated;
GRANT SELECT ON public.payments                   TO authenticated;
GRANT SELECT ON public.profiles                   TO authenticated;

-- =============================================================================
-- Migration 022: Extend audit_action enum with Phase 10 action codes
-- =============================================================================
-- The original 001_enums.sql audit_action enum did not include action codes
-- added during Phase 10 (teachers, classes, payment links).  These values were
-- added to the TypeScript AuditAction union in database.ts but were never
-- persisted to the PostgreSQL enum, causing silent audit-log insert failures
-- whenever a teacher, class, or payment-link write was attempted in the live DB.
-- This migration adds the seven missing values idempotently via ADD VALUE IF NOT EXISTS.

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'class.updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'teacher.created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'teacher.updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'teacher.deactivated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_link.created';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_link.updated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'payment_link.deactivated';
