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
