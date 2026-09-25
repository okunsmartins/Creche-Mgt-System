-- REMAINDER CHUNK 2_050-051 — run this whole file as ONE query, then run the next chunk.
-- Contains migrations: 050_meeting_slots_class.sql, 051_revolut_provider_enum.sql

-- ============================================================
-- 050_meeting_slots_class.sql
-- ============================================================
-- =============================================================================
-- Migration 050: class-targeted meeting slots
-- =============================================================================
-- A teacher with multiple classes can publish availability for ONE class, so
-- only that class's parents can see/book those slots. NULL class_id keeps the
-- original meaning: open to parents of all the teacher's classes (existing
-- rows are unaffected).
--
-- ⚠️ Apply to the REAL production project: jywkpenzhzzptsrntobf
--    ("PrimarySchoolPortal") — NOT "Primary School Mgt Sys".

ALTER TABLE public.meeting_slots
  ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES public.classes(id) ON DELETE SET NULL;

-- ============================================================
-- 051_revolut_provider_enum.sql
-- ============================================================
-- =============================================================================
-- Migration 051: add 'revolut' to the payment_provider enum
-- =============================================================================
-- Enum-only, in its own file: combining ALTER TYPE ... ADD VALUE with other DDL
-- in a single Supabase SQL-editor transaction fails. Run this before 052.
--
-- ⚠️ Apply to the REAL production project: jywkpenzhzzptsrntobf
--    ("PrimarySchoolPortal") — verify the ref in the dashboard URL first.

ALTER TYPE public.payment_provider ADD VALUE IF NOT EXISTS 'revolut';
