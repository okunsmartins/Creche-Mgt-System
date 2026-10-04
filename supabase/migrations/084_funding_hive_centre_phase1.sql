-- =============================================================================
-- Migration 084: Funding & Hive Centre — Phase 1 (NCS compliance)
-- =============================================================================
-- Additive only. Implements the Phase 1 data model from
-- docs/design/hive-funding-centre-impact-assessment.md:
--   * per-tenant feature flag (ships dark)
--   * extend child_funding_registrations into the ChildFundingProfile (nullable cols)
--   * funding_programme_config (programme-year workflow rules)
--   * ncs_weekly_compliance_snapshots (IMMUTABLE weekly calculation)
--   * hive_action_items (the prioritised, explainable action queue)
--
-- Conventions (match 068/071/083): TEXT + CHECK enums, school_id-scoped,
-- set_updated_at trigger (migration 003), RLS on as defence-in-depth, explicit
-- grants (no default privileges — migrations 019–021). Reuses existing child,
-- attendance, fee and document data by FK; does NOT duplicate it.
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl) — verify in
-- the dashboard URL before running.

-- ── Feature flag (ships dark; on the existing per-tenant settings table) ───────
ALTER TABLE public.tenant_funding_settings
  ADD COLUMN IF NOT EXISTS hive_centre_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- ── Extend child_funding_registrations into the ChildFundingProfile ────────────
-- Additive nullable columns only — backward-compatible with the live subvention/
-- fee engine. CHICK + encrypted PPSN already exist on this table (migration 071).
ALTER TABLE public.child_funding_registrations
  ADD COLUMN IF NOT EXISTS ncs_award_expiry DATE,
  ADD COLUMN IF NOT EXISTS ncs_parent_confirmation_status TEXT
    CHECK (ncs_parent_confirmation_status IS NULL OR ncs_parent_confirmation_status
      IN ('UNKNOWN', 'PENDING', 'CONFIRMED', 'NOT_REQUIRED')),
  ADD COLUMN IF NOT EXISTS ecce_session TEXT
    CHECK (ecce_session IS NULL OR ecce_session IN ('AM', 'PM', 'OTHER'));

-- ── funding_programme_config (programme-year workflow rules) ───────────────────
CREATE TABLE public.funding_programme_config (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                 UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  programme                 TEXT NOT NULL CHECK (programme IN ('NCS', 'ECCE', 'CORE_FUNDING', 'AIM')),
  programme_year            TEXT NOT NULL,
  active                    BOOLEAN NOT NULL DEFAULT TRUE,
  rules_version             TEXT NOT NULL,
  submission_deadline_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_funding_config_scope UNIQUE (school_id, programme, programme_year)
);
CREATE INDEX idx_funding_config_scope
  ON public.funding_programme_config(school_id, programme, active);
CREATE TRIGGER trg_funding_programme_config_updated_at
  BEFORE UPDATE ON public.funding_programme_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── ncs_weekly_compliance_snapshots (IMMUTABLE) ───────────────────────────────
-- One row per child per reporting week. Never updated after creation (no trigger);
-- a recalculation under a newer rules version creates a new row / supersedes.
CREATE TABLE public.ncs_weekly_compliance_snapshots (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id                        UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  student_id                       UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  week_start                       DATE NOT NULL,
  actual_attendance_minutes        INTEGER NOT NULL DEFAULT 0,
  ncs_monitoring_minutes           INTEGER NOT NULL DEFAULT 0,
  claimed_minutes                  INTEGER NOT NULL DEFAULT 0,
  under_attended                   BOOLEAN NOT NULL DEFAULT FALSE,
  full_week_absent                 BOOLEAN NOT NULL DEFAULT FALSE,
  consecutive_under_attendance_weeks INTEGER NOT NULL DEFAULT 0,
  consecutive_absence_weeks        INTEGER NOT NULL DEFAULT 0,
  threshold_event                  TEXT NOT NULL DEFAULT 'NONE'
                                     CHECK (threshold_event IN ('NONE', 'ABSENCE_4', 'UNDER_8', 'UNDER_12')),
  risk_state                       TEXT NOT NULL DEFAULT 'NONE'
                                     CHECK (risk_state IN ('NONE', 'APPROACHING_UNDER_ATTENDANCE')),
  service_closure_effect           TEXT NOT NULL DEFAULT 'NONE'
                                     CHECK (service_closure_effect IN ('NONE', 'PAUSE_SEQUENCE')),
  special_circumstances_status     TEXT
                                     CHECK (special_circumstances_status IS NULL OR special_circumstances_status
                                       IN ('PENDING', 'APPROVED', 'REJECTED')),
  calculation_version              TEXT NOT NULL,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_ncs_snapshot_child_week UNIQUE (school_id, student_id, week_start)
);
CREATE INDEX idx_ncs_snapshot_scope
  ON public.ncs_weekly_compliance_snapshots(school_id, week_start DESC);
CREATE INDEX idx_ncs_snapshot_threshold
  ON public.ncs_weekly_compliance_snapshots(school_id, week_start, threshold_event);

-- ── hive_action_items (the prioritised, explainable action queue) ─────────────
CREATE TABLE public.hive_action_items (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id            UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  programme            TEXT NOT NULL CHECK (programme IN ('NCS', 'ECCE', 'CORE_FUNDING', 'AIM')),
  action_type          TEXT NOT NULL,
  entity_type          TEXT,
  entity_id            UUID,
  severity             TEXT NOT NULL DEFAULT 'ACTION' CHECK (severity IN ('INFO', 'ACTION', 'URGENT')),
  due_at               TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'OPEN'
                         CHECK (status IN ('OPEN', 'IN_REVIEW', 'VERIFIED', 'COMPLETED', 'DISMISSED_WITH_REASON')),
  reason_code          TEXT,
  description          TEXT,
  -- Stable key used to avoid creating duplicate open actions for the same cause.
  dedupe_key           TEXT,
  assigned_to          UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  evidence_document_id UUID,
  dismissed_reason     TEXT,
  completed_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_hive_action_queue
  ON public.hive_action_items(school_id, status, severity, due_at);
-- At most one live (OPEN/IN_REVIEW) action per cause per tenant.
CREATE UNIQUE INDEX uq_hive_action_dedupe_live
  ON public.hive_action_items(school_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL AND status IN ('OPEN', 'IN_REVIEW');
CREATE TRIGGER trg_hive_action_items_updated_at
  BEFORE UPDATE ON public.hive_action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS (defence-in-depth; the service-role client does the work) ──────────────
ALTER TABLE public.funding_programme_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ncs_weekly_compliance_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hive_action_items ENABLE ROW LEVEL SECURITY;

-- ── Grants (no default privileges — see migrations 019–021) ───────────────────
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.funding_programme_config TO authenticated;
GRANT SELECT ON public.ncs_weekly_compliance_snapshots TO authenticated;
GRANT SELECT ON public.hive_action_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funding_programme_config TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ncs_weekly_compliance_snapshots TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hive_action_items TO service_role;

-- ── New funding permissions (reuse the RBAC model; seeded dark where possible) ─
-- Added as permission rows; mapping to roles follows the project's seed pattern
-- (migration 009). Sensitive/AIM permissions are NOT granted to any role by default.
INSERT INTO public.permissions (name, description)
VALUES
  ('funding.view', 'View the Funding & Hive Centre dashboard and action counts'),
  ('funding.manage_ncs', 'Prepare and verify NCS funding data'),
  ('funding.manage_ecce', 'Prepare ECCE registrations'),
  ('funding.view_sensitive_identifiers', 'Reveal PPSN/CHICK where policy permits'),
  ('funding.manage_core', 'Manage Core Funding snapshots and actions'),
  ('funding.manage_aim', 'Access restricted AIM case data'),
  ('funding.export', 'Generate and download verified funding exports'),
  ('funding.mark_submitted', 'Mark a funding item completed externally and attach evidence'),
  ('funding.override_calculation', 'Override a funding calculation (reason + audit required)')
ON CONFLICT (name) DO NOTHING;

-- Grant the NON-sensitive funding permissions to admin roles. The sensitive ones
-- (view_sensitive_identifiers, manage_aim, override_calculation) are deliberately
-- left unmapped — the owner grants them explicitly per the security requirements.
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.name IN ('super_admin', 'school_admin')
  AND p.name IN (
    'funding.view', 'funding.manage_ncs', 'funding.manage_ecce',
    'funding.manage_core', 'funding.export', 'funding.mark_submitted'
  )
ON CONFLICT DO NOTHING;
