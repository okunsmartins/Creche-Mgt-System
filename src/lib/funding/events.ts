import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { reportingWeekStart } from './week'
import { recomputeChildWeekById } from './service'
import { reconcileClaimBilling } from './reconcile'
import { getCoreFundingView } from './queries'
import { summariseDrift } from './core-funding'
import { CURRENT_PROGRAMME_YEAR } from './rules'

// ─────────────────────────────────────────────────────────────────────────────
// Operational → compliance event wiring (addendum §9).
//
// Existing mutating server actions (attendance, fees, staff, rooms) call these
// hooks after they succeed so the Hive action queue reacts to real operational
// changes — not just the manual "run" button and the weekly cron. Every handler is:
//   • FLAG-GATED  — does nothing unless the tenant has the Hive Centre enabled;
//   • BEST-EFFORT — fully wrapped in try/catch so a funding hiccup never breaks the
//                   operational action that triggered it;
//   • TENANT-SAFE — everything is school_id-scoped;
//   • IDEMPOTENT  — snapshots upsert, actions dedupe (shared dedupe keys with the
//                   manual/cron paths), so repeated events don't pile up duplicates.
// These are intentionally awaited (so the recompute lands before revalidation) but
// never throw.
// ─────────────────────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

async function hiveEnabled(db: AdminClient, schoolId: string): Promise<boolean> {
  const { data } = await db
    .from('tenant_funding_settings')
    .select('hive_centre_enabled')
    .eq('school_id', schoolId)
    .maybeSingle()
  return Boolean((data as { hive_centre_enabled: boolean } | null)?.hive_centre_enabled)
}

/**
 * Attendance for a child changed (check-in / check-out / undo). Recompute that child's
 * NCS weekly snapshot + threshold/risk action for the reporting week the date falls in.
 */
export async function onAttendanceChanged(
  schoolId: string,
  studentId: string,
  date: string,
): Promise<void> {
  try {
    const db = createSupabaseAdminClient()
    if (!(await hiveEnabled(db, schoolId))) return
    await recomputeChildWeekById(schoolId, studentId, reportingWeekStart(date))
  } catch (err) {
    logger.error('funding_event_attendance_failed', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}

/**
 * A child's fee plan or billing changed (new fee schedule, invoices generated). Re-run
 * the co-payment reconciliation against the child's latest prepared NCS claim so a
 * mismatch surfaces (or auto-resolves) without anyone re-opening the claim. Never
 * mutates the claim or the invoice.
 */
export async function onFeePlanChanged(schoolId: string, studentId: string): Promise<void> {
  try {
    const db = createSupabaseAdminClient()
    if (!(await hiveEnabled(db, schoolId))) return
    const { data } = await db
      .from('ncs_claim_versions')
      .select('calculated_copayment_cents, manual_override_cents')
      .eq('school_id', schoolId)
      .eq('student_id', studentId)
      .neq('status', 'SUPERSEDED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    const claim = data as {
      calculated_copayment_cents: number | null
      manual_override_cents: number | null
    } | null
    if (!claim) return // no prepared claim to reconcile against
    const copay = claim.manual_override_cents ?? claim.calculated_copayment_cents
    if (copay == null) return
    await reconcileClaimBilling(schoolId, studentId, copay)
  } catch (err) {
    logger.error('funding_event_fee_failed', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}

/**
 * Staff or rooms changed (teacher/class created, activated or deactivated). Re-evaluate
 * the Core Funding shadow profile against the last verified snapshot: raise a deduped
 * CORE_FUNDING_DRIFT review action when it now differs, or auto-resolve an open one when
 * it matches again. Shares the dedupe key with the manual "Flag for review" + capture
 * flows, so the three never double up. No drift is raised until a snapshot exists.
 */
export async function onStaffOrRoomChanged(schoolId: string): Promise<void> {
  try {
    const db = createSupabaseAdminClient()
    if (!(await hiveEnabled(db, schoolId))) return
    const view = await getCoreFundingView(schoolId, CURRENT_PROGRAMME_YEAR)
    const dedupeKey = `core:DRIFT:${CURRENT_PROGRAMME_YEAR}`

    if (view.changes.length === 0) {
      // Matches the verified snapshot (or none captured yet) — clear any open drift.
      await db
        .from('hive_action_items')
        .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
        .eq('school_id', schoolId)
        .eq('dedupe_key', dedupeKey)
        .in('status', ['OPEN', 'IN_REVIEW'])
      return
    }

    const { error } = await db.from('hive_action_items').insert({
      school_id: schoolId,
      programme: 'CORE_FUNDING',
      action_type: 'CORE_FUNDING_DRIFT',
      entity_type: 'service',
      severity: 'ACTION',
      status: 'OPEN',
      reason_code: 'CORE_DRIFT',
      description: `Core Funding profile has drifted from the last verified snapshot (${summariseDrift(view.changes)}). Review whether an application change or Review & Confirm update is needed.`,
      dedupe_key: dedupeKey,
    })
    if (error && !/duplicate key|unique/i.test(error.message)) {
      logger.error('funding_event_core_drift_failed', { schoolId, error: error.message })
    }
  } catch (err) {
    logger.error('funding_event_staff_room_failed', {
      schoolId,
      error: err instanceof Error ? err.message : 'Unknown error',
    })
  }
}
