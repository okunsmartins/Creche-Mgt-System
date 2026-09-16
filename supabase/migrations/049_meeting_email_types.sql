-- =============================================================================
-- Migration 049: enum values for meeting-booking notifications
-- =============================================================================
-- Enum-only migration (no table DDL) — ALTER TYPE ... ADD VALUE must commit
-- before the values can be referenced, so they are isolated here. Used by the
-- booking/cancellation emails logged to email_notifications.

ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'meeting_booked';
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'meeting_cancelled';
