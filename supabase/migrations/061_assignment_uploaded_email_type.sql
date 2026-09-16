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
