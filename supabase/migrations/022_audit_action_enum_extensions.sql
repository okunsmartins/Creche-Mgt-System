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
