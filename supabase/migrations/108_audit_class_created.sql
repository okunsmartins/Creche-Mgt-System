-- Migration 108: audit action for creating a room (class) from the admin Rooms page.
-- Safe to re-run. Until applied, room creation still works; only its audit row fails
-- (audit writes are best-effort and logged).
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'class.created';
