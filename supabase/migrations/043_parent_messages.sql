-- =============================================================================
-- Migration 043: Parent messaging email type — feature #1, Phase 1
-- =============================================================================
-- New email_type value for direct teacher/admin → parent messages. Kept in its
-- OWN migration: ALTER TYPE ... ADD VALUE must commit before the value can be
-- referenced, and combining it with other DDL in one Supabase SQL-editor run
-- (a single transaction) fails. The table + RLS live in migration 044.
ALTER TYPE public.email_type ADD VALUE IF NOT EXISTS 'parent_message';
