import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'

export interface HiveActionView {
  id: string
  programme: string
  actionType: string
  severity: 'INFO' | 'ACTION' | 'URGENT'
  description: string | null
  dueAt: string | null
  status: string
  childName: string | null
}

export interface FundingDashboard {
  openActions: HiveActionView[]
  severityCounts: { URGENT: number; ACTION: number; INFO: number }
  latestWeek: { weekStart: string; total: number; review: number; clear: number } | null
}

const SEV_ORDER: Record<string, number> = { URGENT: 0, ACTION: 1, INFO: 2 }

/** Dashboard data for the Funding & Hive Centre (school-scoped). */
export async function getFundingDashboard(schoolId: string): Promise<FundingDashboard> {
  const db = createSupabaseAdminClient()

  // Live action queue (OPEN / IN_REVIEW), most severe + soonest-due first.
  const { data: actionData } = await db
    .from('hive_action_items')
    .select(
      'id, programme, action_type, severity, description, due_at, status, entity_type, entity_id',
    )
    .eq('school_id', schoolId)
    .in('status', ['OPEN', 'IN_REVIEW'])
  const actionRows =
    (actionData as
      | {
          id: string
          programme: string
          action_type: string
          severity: 'INFO' | 'ACTION' | 'URGENT'
          description: string | null
          due_at: string | null
          status: string
          entity_type: string | null
          entity_id: string | null
        }[]
      | null) ?? []

  // Resolve child names for child-entity actions.
  const childIds = [
    ...new Set(
      actionRows.filter((a) => a.entity_type === 'child' && a.entity_id).map((a) => a.entity_id!),
    ),
  ]
  const nameById = new Map<string, string>()
  if (childIds.length > 0) {
    const { data: students } = await db
      .from('students')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .in('id', childIds)
    for (const s of (students as
      | { id: string; first_name: string | null; last_name: string | null }[]
      | null) ?? []) {
      nameById.set(s.id, [s.first_name, s.last_name].filter(Boolean).join(' ') || '—')
    }
  }

  const openActions: HiveActionView[] = actionRows
    .map((a) => ({
      id: a.id,
      programme: a.programme,
      actionType: a.action_type,
      severity: a.severity,
      description: a.description,
      dueAt: a.due_at,
      status: a.status,
      childName:
        a.entity_type === 'child' && a.entity_id ? (nameById.get(a.entity_id) ?? null) : null,
    }))
    .sort((x, y) => {
      const s = (SEV_ORDER[x.severity] ?? 9) - (SEV_ORDER[y.severity] ?? 9)
      if (s !== 0) return s
      return (x.dueAt ?? '').localeCompare(y.dueAt ?? '')
    })

  const severityCounts = { URGENT: 0, ACTION: 0, INFO: 0 }
  for (const a of openActions) severityCounts[a.severity]++

  // Latest built reporting week summary.
  const { data: weekRow } = await db
    .from('ncs_weekly_compliance_snapshots')
    .select('week_start')
    .eq('school_id', schoolId)
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle()
  const latestWeekStart = (weekRow as { week_start: string } | null)?.week_start ?? null

  let latestWeek: FundingDashboard['latestWeek'] = null
  if (latestWeekStart) {
    const { data: snaps } = await db
      .from('ncs_weekly_compliance_snapshots')
      .select('threshold_event, risk_state')
      .eq('school_id', schoolId)
      .eq('week_start', latestWeekStart)
    const rows = (snaps as { threshold_event: string; risk_state: string }[] | null) ?? []
    const review = rows.filter(
      (r) => r.threshold_event !== 'NONE' || r.risk_state !== 'NONE',
    ).length
    latestWeek = {
      weekStart: latestWeekStart,
      total: rows.length,
      review,
      clear: rows.length - review,
    }
  }

  return { openActions, severityCounts, latestWeek }
}

export interface NcsReturnRow {
  studentId: string
  childName: string
  claimedMinutes: number
  actualMinutes: number
  monitoringMinutes: number
  underAttended: boolean
  fullWeekAbsent: boolean
  consecutiveUnderWeeks: number
  consecutiveAbsenceWeeks: number
  thresholdEvent: string
  riskState: string
  calculationVersion: string
}

export interface NcsWeeklyReturn {
  weekStart: string
  reviewRequired: NcsReturnRow[]
  noActionCount: number
  total: number
  calculationVersion: string | null
}

/** The prepared NCS weekly return for one reporting week (exception list + counts). */
export async function getNcsWeeklyReturn(
  schoolId: string,
  weekStart: string,
): Promise<NcsWeeklyReturn> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('ncs_weekly_compliance_snapshots')
    .select(
      'student_id, claimed_minutes, actual_attendance_minutes, ncs_monitoring_minutes, under_attended, full_week_absent, consecutive_under_attendance_weeks, consecutive_absence_weeks, threshold_event, risk_state, calculation_version, students(first_name, last_name)',
    )
    .eq('school_id', schoolId)
    .eq('week_start', weekStart)
  const rows =
    (data as unknown as
      | {
          student_id: string
          claimed_minutes: number
          actual_attendance_minutes: number
          ncs_monitoring_minutes: number
          under_attended: boolean
          full_week_absent: boolean
          consecutive_under_attendance_weeks: number
          consecutive_absence_weeks: number
          threshold_event: string
          risk_state: string
          calculation_version: string
          students: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []

  const mapped: NcsReturnRow[] = rows.map((r) => ({
    studentId: r.student_id,
    childName: [r.students?.first_name, r.students?.last_name].filter(Boolean).join(' ') || '—',
    claimedMinutes: r.claimed_minutes,
    actualMinutes: r.actual_attendance_minutes,
    monitoringMinutes: r.ncs_monitoring_minutes,
    underAttended: r.under_attended,
    fullWeekAbsent: r.full_week_absent,
    consecutiveUnderWeeks: r.consecutive_under_attendance_weeks,
    consecutiveAbsenceWeeks: r.consecutive_absence_weeks,
    thresholdEvent: r.threshold_event,
    riskState: r.risk_state,
    calculationVersion: r.calculation_version,
  }))

  const reviewRequired = mapped
    .filter((r) => r.thresholdEvent !== 'NONE' || r.riskState !== 'NONE')
    .sort((a, b) => b.consecutiveUnderWeeks - a.consecutiveUnderWeeks)

  return {
    weekStart,
    reviewRequired,
    noActionCount: mapped.length - reviewRequired.length,
    total: mapped.length,
    calculationVersion: mapped[0]?.calculationVersion ?? null,
  }
}
