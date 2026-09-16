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
