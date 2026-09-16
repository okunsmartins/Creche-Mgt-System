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
