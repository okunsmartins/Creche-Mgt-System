-- =============================================================================
-- Migration 097: Parent mobile number on the child record
-- =============================================================================
-- A direct parent/guardian mobile number captured on the child, set in the child
-- setup (create) and edit forms, so staff can text the parent (SMS). Stored on the
-- student row for simple per-child editing regardless of linked parent accounts.
--
-- No RLS/grant changes — inherits the students table's existing policies/grants.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS parent_mobile TEXT;
