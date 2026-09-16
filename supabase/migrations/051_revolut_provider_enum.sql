-- =============================================================================
-- Migration 051: add 'revolut' to the payment_provider enum
-- =============================================================================
-- Enum-only, in its own file: combining ALTER TYPE ... ADD VALUE with other DDL
-- in a single Supabase SQL-editor transaction fails. Run this before 052.
--
-- ⚠️ Apply to the REAL production project: jywkpenzhzzptsrntobf
--    ("PrimarySchoolPortal") — verify the ref in the dashboard URL first.

ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'revolut';
