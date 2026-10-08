-- =============================================================================
-- Migration 102: Room capacity + child expected leaving date (places & leavers)
-- =============================================================================
-- Capacity per room (to compute available places / vacancies) and an expected leaving
-- date per child (to surface upcoming leavers → upcoming vacancies). Both optional.
--
-- No RLS/grant changes — inherit the classes/students existing policies/grants.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS capacity INTEGER CHECK (capacity IS NULL OR capacity >= 0);

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS leaving_date DATE;
