-- =============================================================================
-- Migration 091: Child care record fields (emergency contact, health, medication,
--                dietary, session)
-- =============================================================================
-- Additive, all nullable (medication_consent defaults false). Extends the students
-- record with the operational care information a crèche needs on hand. These include
-- health-related fields (allergies, medical conditions, medication) — treat as
-- sensitive: never place the values in logs, audit metadata, analytics or notification
-- text. Room is the existing class_id; `session` is the new daily-attendance pattern.
--
-- Conventions: school_id-scoped via the students table (existing RLS + grants cover new
-- columns); no data backfill. ⚠️ Apply to the REAL production project
-- (ref xpbavfutfejlfbmnntyl).

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS emergency_contact_name         TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone        TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
  ADD COLUMN IF NOT EXISTS allergies                      TEXT,
  ADD COLUMN IF NOT EXISTS dietary_needs                  TEXT,
  ADD COLUMN IF NOT EXISTS medical_conditions             TEXT,
  ADD COLUMN IF NOT EXISTS medication_consent             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS medication_notes               TEXT,
  ADD COLUMN IF NOT EXISTS session                        TEXT
    CHECK (session IS NULL OR session IN ('FULL_DAY', 'MORNING', 'AFTERNOON', 'OTHER'));
