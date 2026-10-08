-- =============================================================================
-- Migration 101: Per-child meal plan (breakfast & meal options)
-- =============================================================================
-- Which meals a child is signed up for, set on the child record. Informational for staff
-- (and a basis for meal charges later). Booleans default false; notes optional.
--
-- No RLS/grant changes — inherits the students table's existing policies/grants.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS meal_breakfast BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meal_lunch     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meal_tea       BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS meal_notes     TEXT;
