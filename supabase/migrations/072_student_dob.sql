-- =============================================================================
-- Migration 072: Promote child date-of-birth to a real column
-- =============================================================================
-- DOB has been riding in students.custom_fields->>'dateOfBirth' (from the import
-- wizard). It's needed as a first-class column for NCS age-eligibility checks and
-- age-band ratio grouping, so promote it and backfill existing rows.
--
-- Safe/backward-compatible: adds a nullable column, backfills only well-formed
-- ISO dates, and leaves custom_fields untouched (the app reads the column first,
-- falling back to custom_fields until every row is migrated). No grants needed —
-- students is already granted (service_role full, authenticated SELECT).

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Backfill from the JSONB bag where a valid YYYY-MM-DD value exists.
UPDATE public.students
SET date_of_birth = (custom_fields->>'dateOfBirth')::date
WHERE date_of_birth IS NULL
  AND custom_fields ? 'dateOfBirth'
  AND (custom_fields->>'dateOfBirth') ~ '^\d{4}-\d{2}-\d{2}$';

CREATE INDEX IF NOT EXISTS idx_students_dob ON public.students(school_id, date_of_birth);
