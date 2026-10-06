import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { logger } from '@/lib/logging'
import { resolveNcsRules, CURRENT_NCS_RULES_VERSION } from './rules'
import {
  advanceWeek,
  ncsEligibleMinutes,
  EMPTY_SEQUENCE,
  type SequenceState,
  type ThresholdEvent,
  type RiskState,
} from './ncs-compliance'
import { weekDates, previousWeekStart, weekEnd, latestCompletedWeekStart } from './week'

type AdminClient = ReturnType<typeof createSupabaseAdminClient>

export interface WeeklyBuildSummary {
  weekStart: string
  totalChildren: number
  clear: number
  review: number
  actionsCreated: number
}

interface ActiveNcsChild {
  studentId: string
  claimedMinutes: number
  firstName: string
  lastName: string
}

/** Minutes between check-in and check-out (0 if either missing or negative). */
function minutesBetween(inAt: string | null, outAt: string | null): number {
  if (!inAt || !outAt) return 0
  const ms = new Date(outAt).getTime() - new Date(inAt).getTime()
  return ms > 0 ? Math.round(ms / 60000) : 0
}

/** Active NCS children for a school, with their claimed weekly minutes. */
async function loadActiveNcsChildren(db: AdminClient, schoolId: string): Promise<ActiveNcsChild[]> {
  const { data } = await db
    .from('child_funding_registrations')
    .select('student_id, awarded_weekly_hours, students(first_name, last_name)')
    .eq('school_id', schoolId)
    .eq('scheme', 'NCS')
    .eq('status', 'ACTIVE')
  const rows =
    (data as unknown as
      | {
          student_id: string
          awarded_weekly_hours: number | null
          students: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []
  return rows.map((r) => ({
    studentId: r.student_id,
    claimedMinutes: Math.round((r.awarded_weekly_hours ?? 0) * 60),
    firstName: r.students?.first_name ?? '',
    lastName: r.students?.last_name ?? '',
  }))
}

/** Prior week's snapshot → the running sequence state (empty if none). */
async function loadPriorState(
  db: AdminClient,
  schoolId: string,
  studentId: string,
  weekStart: string,
): Promise<SequenceState> {
  const { data } = await db
    .from('ncs_weekly_compliance_snapshots')
    .select('consecutive_under_attendance_weeks, consecutive_absence_weeks')
    .eq('school_id', schoolId)
    .eq('student_id', studentId)
    .eq('week_start', previousWeekStart(weekStart))
    .maybeSingle()
  const row = data as {
    consecutive_under_attendance_weeks: number
    consecutive_absence_weeks: number
  } | null
  if (!row) return EMPTY_SEQUENCE
  return {
    consecutiveUnderAttendanceWeeks: row.consecutive_under_attendance_weeks,
    consecutiveAbsenceWeeks: row.consecutive_absence_weeks,
  }
}

const SEVERITY: Record<Exclude<ThresholdEvent, 'NONE'> | 'RISK', 'INFO' | 'ACTION' | 'URGENT'> = {
  ABSENCE_4: 'ACTION',
  UNDER_8: 'ACTION',
  UNDER_12: 'URGENT',
  RISK: 'INFO',
}

/** Plain-language, explainable description for an NCS compliance action. */
function describe(
  event: ThresholdEvent,
  risk: RiskState,
  child: ActiveNcsChild,
  attendedMinutes: number,
  underWeeks: number,
  absenceWeeks: number,
): { actionType: string; severity: 'INFO' | 'ACTION' | 'URGENT'; text: string } {
  const name = [child.firstName, child.lastName].filter(Boolean).join(' ') || 'child'
  const claimedH = (child.claimedMinutes / 60).toFixed(1)
  const actualH = (attendedMinutes / 60).toFixed(1)
  if (event === 'ABSENCE_4')
    return {
      actionType: 'NCS_ABSENCE_4W',
      severity: SEVERITY.ABSENCE_4,
      text: `${name} has been fully absent for ${absenceWeeks} consecutive weeks. NCS requires this to be reported on the weekly return.`,
    }
  if (event === 'UNDER_12')
    return {
      actionType: 'NCS_UNDER_ATTENDANCE_12W',
      severity: SEVERITY.UNDER_12,
      text: `${name} has under-attended for ${underWeeks} consecutive weeks (claimed ${claimedH}h, ${actualH}h this week). This is the continued-under-attendance stage — report urgently.`,
    }
  if (event === 'UNDER_8')
    return {
      actionType: 'NCS_UNDER_ATTENDANCE_8W',
      severity: SEVERITY.UNDER_8,
      text: `${name} has under-attended for ${underWeeks} consecutive weeks (claimed ${claimedH}h, ${actualH}h this week). The 8-week under-attendance threshold has been reached — report on the weekly return.`,
    }
  // risk
  return {
    actionType: 'NCS_UNDER_ATTENDANCE_RISK',
    severity: SEVERITY.RISK,
    text: `${name} is approaching the 8-week under-attendance threshold (${underWeeks} consecutive weeks so far; claimed ${claimedH}h, ${actualH}h this week). Review before it becomes reportable.`,
  }
}

/** Create a live action for this snapshot if one is warranted (deduped). */
async function ensureAction(
  db: AdminClient,
  schoolId: string,
  child: ActiveNcsChild,
  weekStart: string,
  event: ThresholdEvent,
  risk: RiskState,
  attendedMinutes: number,
  underWeeks: number,
  absenceWeeks: number,
): Promise<boolean> {
  if (event === 'NONE' && risk === 'NONE') return false
  const d = describe(event, risk, child, attendedMinutes, underWeeks, absenceWeeks)
  const dedupeKey = `ncs:${d.actionType}:${child.studentId}:${weekStart}`
  // Weekly return is due the Tuesday after the reporting week ends (Sunday).
  const dueAt = new Date(`${weekEnd(weekStart)}T00:00:00.000Z`)
  dueAt.setUTCDate(dueAt.getUTCDate() + 2)

  const { error } = await db.from('hive_action_items').insert({
    school_id: schoolId,
    programme: 'NCS',
    action_type: d.actionType,
    entity_type: 'child',
    entity_id: child.studentId,
    severity: d.severity,
    due_at: dueAt.toISOString(),
    status: 'OPEN',
    reason_code: event !== 'NONE' ? event : 'APPROACHING_UNDER_ATTENDANCE',
    description: d.text,
    dedupe_key: dedupeKey,
  })
  // Unique partial index rejects a duplicate live action — treat that as success.
  if (error && !/duplicate key|unique/i.test(error.message)) {
    logger.error('hive_action_insert_failed', { schoolId, dedupeKey, error: error.message })
    return false
  }
  return !error
}

/**
 * Recompute + persist one child's immutable weekly snapshot and (deduped) action for a
 * reporting week. Shared by the full weekly build and the event-driven recompute.
 * Idempotent: upserts the snapshot and relies on the live-dedupe index for actions.
 * Reads raw attendance from daily_check_ins; never writes attendance back.
 */
async function recomputeChild(
  db: AdminClient,
  schoolId: string,
  child: ActiveNcsChild,
  weekStart: string,
  rules: ReturnType<typeof resolveNcsRules>,
): Promise<{ outcome: 'clear' | 'review'; actionCreated: boolean } | null> {
  const dates = weekDates(weekStart)

  const { data: ciData } = await db
    .from('daily_check_ins')
    .select('date, checked_in_at, checked_out_at, status')
    .eq('school_id', schoolId)
    .eq('student_id', child.studentId)
    .in('date', dates)
  const checkIns =
    (ciData as
      | {
          date: string
          checked_in_at: string | null
          checked_out_at: string | null
          status: string
        }[]
      | null) ?? []

  const attendedMinutes = checkIns.reduce(
    (sum, c) => sum + minutesBetween(c.checked_in_at, c.checked_out_at),
    0,
  )
  const daysPresent = checkIns.filter((c) => c.checked_in_at && c.status !== 'absent').length
  const fullWeekAbsent = daysPresent === 0

  // ECCE/non-subsidised exclusion hook — Phase 1 excludes 0 (wired in Phase 3).
  const ncsAttendedMinutes = ncsEligibleMinutes(attendedMinutes, 0)

  const prior = await loadPriorState(db, schoolId, child.studentId, weekStart)
  const result = advanceWeek(
    prior,
    { ncsAttendedMinutes, claimedMinutes: child.claimedMinutes, fullWeekAbsent },
    rules,
  )

  const { error: snapErr } = await db.from('ncs_weekly_compliance_snapshots').upsert(
    {
      school_id: schoolId,
      student_id: child.studentId,
      week_start: weekStart,
      actual_attendance_minutes: attendedMinutes,
      ncs_monitoring_minutes: ncsAttendedMinutes,
      claimed_minutes: child.claimedMinutes,
      under_attended: result.underAttended,
      full_week_absent: result.fullWeekAbsent,
      consecutive_under_attendance_weeks: result.consecutiveUnderAttendanceWeeks,
      consecutive_absence_weeks: result.consecutiveAbsenceWeeks,
      threshold_event: result.thresholdEvent,
      risk_state: result.riskState,
      service_closure_effect: result.closureEffect,
      calculation_version: CURRENT_NCS_RULES_VERSION,
    },
    { onConflict: 'school_id,student_id,week_start' },
  )
  if (snapErr) {
    logger.error('ncs_snapshot_upsert_failed', { schoolId, error: snapErr.message })
    return null
  }

  const needsAction = result.thresholdEvent !== 'NONE' || result.riskState !== 'NONE'
  if (!needsAction) return { outcome: 'clear', actionCreated: false }
  const created = await ensureAction(
    db,
    schoolId,
    child,
    weekStart,
    result.thresholdEvent,
    result.riskState,
    ncsAttendedMinutes,
    result.consecutiveUnderAttendanceWeeks,
    result.consecutiveAbsenceWeeks,
  )
  return { outcome: 'review', actionCreated: created }
}

/**
 * Build the NCS weekly compliance snapshots + actions for one school and reporting
 * week. Idempotent: re-running recomputes the week's snapshot (upsert) and relies on
 * the live-dedupe index so actions are not duplicated. Reads raw attendance from
 * daily_check_ins; never writes attendance back.
 */
export async function buildWeeklyCompliance(
  schoolId: string,
  weekStart: string,
): Promise<WeeklyBuildSummary> {
  const db = createSupabaseAdminClient()
  const rules = resolveNcsRules()
  const children = await loadActiveNcsChildren(db, schoolId)

  let clear = 0
  let review = 0
  let actionsCreated = 0

  for (const child of children) {
    const r = await recomputeChild(db, schoolId, child, weekStart, rules)
    if (!r) continue
    if (r.outcome === 'review') {
      review++
      if (r.actionCreated) actionsCreated++
    } else {
      clear++
    }
  }

  logger.info('ncs_weekly_compliance_built', {
    schoolId,
    weekStart,
    total: children.length,
    review,
    actionsCreated,
  })
  return { weekStart, totalChildren: children.length, clear, review, actionsCreated }
}

/**
 * Event-driven recompute of a single active-NCS child's weekly snapshot + action for
 * the reporting week containing `weekStart`. No-op when the child isn't an active NCS
 * child. Reuses the exact weekly-build logic so manual, cron and event paths agree.
 */
export async function recomputeChildWeekById(
  schoolId: string,
  studentId: string,
  weekStart: string,
): Promise<void> {
  const db = createSupabaseAdminClient()
  const rules = resolveNcsRules()
  const children = await loadActiveNcsChildren(db, schoolId)
  const child = children.find((c) => c.studentId === studentId)
  if (!child) return // not an active NCS child — nothing to compute
  await recomputeChild(db, schoolId, child, weekStart, rules)
}

/**
 * Build the weekly compliance for every tenant that has the Funding & Hive Centre
 * enabled. Tenant-safe (each build is school-scoped) and idempotent — safe to run
 * on a schedule. Defaults to the most recently completed reporting week.
 */
export async function buildWeeklyComplianceForEnabledTenants(
  weekStart: string = latestCompletedWeekStart(),
): Promise<{ weekStart: string; tenants: number; summaries: WeeklyBuildSummary[] }> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('tenant_funding_settings')
    .select('school_id')
    .eq('hive_centre_enabled', true)
    .eq('ncs_enabled', true)
  const schoolIds = ((data as { school_id: string }[] | null) ?? []).map((r) => r.school_id)

  const summaries: WeeklyBuildSummary[] = []
  for (const schoolId of schoolIds) {
    try {
      summaries.push(await buildWeeklyCompliance(schoolId, weekStart))
    } catch (err) {
      logger.error('ncs_weekly_build_tenant_failed', {
        schoolId,
        weekStart,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }
  return { weekStart, tenants: schoolIds.length, summaries }
}
