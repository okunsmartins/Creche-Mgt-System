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
