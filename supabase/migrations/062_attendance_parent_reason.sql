-- =============================================================================
-- Migration 062: parent-entered absence/late reasons
-- =============================================================================
-- Lets a parent record a reason for a day their child was marked absent or late,
-- on the existing per-(session, student) attendance record. Separate from the
-- teacher's `note` so the two never overwrite each other. Written server-side via
-- the service-role client after verifying the parent↔child link, so no new RLS
-- policy is required; the columns inherit the table's existing grants (migration
-- 032).
--
-- ⚠️ Apply to the REAL production project `jywkpenzhzzptsrntobf`
-- ("PrimarySchoolPortal") — verify the ref in the dashboard URL before running.

ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS parent_reason    TEXT,
  ADD COLUMN IF NOT EXISTS parent_reason_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS parent_reason_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
