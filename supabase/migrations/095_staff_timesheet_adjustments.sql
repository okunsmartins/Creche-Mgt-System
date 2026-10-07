-- =============================================================================
-- Migration 095: Staff timesheet adjustments (audit trail)
-- =============================================================================
-- Master spec §7.5: "Timesheets generated from clocking plus manager adjustments WITH
-- AUDIT REASON." Every time an admin changes a timesheet's actual worked times, we append
-- an immutable row here recording the old → new times, the reason, and who/when. The
-- timesheet itself keeps the current values; this table is the append-only history.
--
-- Conventions: school_id-scoped, RLS on, explicit grants (no default privileges). No
-- updated_at trigger — rows are write-once (audit log).
--
-- ⚠️ Apply to the REAL production project (ref xpbavfutfejlfbmnntyl).

CREATE TABLE public.staff_timesheet_adjustments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id     UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  timesheet_id  UUID NOT NULL REFERENCES public.staff_timesheets(id) ON DELETE CASCADE,
  old_actual_start TIME NOT NULL,
  old_actual_end   TIME NOT NULL,
  new_actual_start TIME NOT NULL,
  new_actual_end   TIME NOT NULL,
  reason        TEXT NOT NULL,
  adjusted_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  adjusted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_adjustment_reason_not_empty CHECK (btrim(reason) <> '')
);

CREATE INDEX idx_timesheet_adjustments_sheet
  ON public.staff_timesheet_adjustments(school_id, timesheet_id, adjusted_at DESC);

-- ── RLS + grants ──────────────────────────────────────────────────────────────
ALTER TABLE public.staff_timesheet_adjustments ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.staff_timesheet_adjustments TO authenticated;
GRANT SELECT, INSERT ON public.staff_timesheet_adjustments TO service_role;
