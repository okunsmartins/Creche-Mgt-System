-- =============================================================================
-- Migration 096: Staff certifications (qualifications & training expiry reminders)
-- =============================================================================
-- Master spec §7.5: "Qualification, training and Garda-vetting expiry reminders." Garda
-- vetting has its own table (094); this covers qualifications, training and other
-- certifications. A staff member can hold MANY certs, so rows are keyed by id (not one per
-- teacher). Each carries an expiry date that drives the renewal alerts on
-- /admin/certifications and the admin-dashboard reminder.
--
-- Conventions: school_id-scoped, set_updated_at trigger (003), RLS on, explicit grants
-- (no default privileges).
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.staff_certifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'qualification'
                 CHECK (kind IN ('qualification', 'training', 'other')),
  name         TEXT NOT NULL,
  reference    TEXT,
  issued_date  DATE,
  expiry_date  DATE,
  notes        TEXT,
  created_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_certification_name_not_empty CHECK (btrim(name) <> '')
);

CREATE INDEX idx_staff_certifications_teacher ON public.staff_certifications(school_id, teacher_id);
CREATE INDEX idx_staff_certifications_expiry  ON public.staff_certifications(school_id, expiry_date);

CREATE TRIGGER trg_staff_certifications_updated_at
  BEFORE UPDATE ON public.staff_certifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.staff_certifications ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.staff_certifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_certifications TO service_role;
