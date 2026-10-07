import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { weekDays } from './rota'
import { actualMinutes, varianceMinutes } from './timesheets'

export interface TimesheetEntry {
  id: string
  teacherId: string
  teacherName: string
  workDate: string
  plannedStart: string
  plannedEnd: string
  actualStart: string
  actualEnd: string
  status: string
  actualMinutes: number
  varianceMinutes: number
  /** Reason for the most recent actual-hours adjustment, if any (audit trail). */
  lastAdjustmentReason: string | null
  adjustmentCount: number
}

export interface TimesheetStaffTotal {
  teacherId: string
  name: string
  approvedMinutes: number
  totalMinutes: number
  pending: number
}

export interface TimesheetWeek {
  weekStart: string
  entries: TimesheetEntry[]
  staffTotals: TimesheetStaffTotal[]
}

/**
 * Timesheets for one week: entries (planned vs actual + variance + status) sorted by
 * date then staff, and per-staff totals (approved hours + all hours + pending count).
 * School_id-scoped.
 */
export async function getWeekTimesheets(
  schoolId: string,
  weekStart: string,
): Promise<TimesheetWeek> {
  const db = createSupabaseAdminClient()
  const dates = weekDays(weekStart)

  const { data } = await db
    .from('staff_timesheets')
    .select(
      'id, teacher_id, work_date, planned_start, planned_end, actual_start, actual_end, status, teachers(first_name, last_name)',
    )
    .eq('school_id', schoolId)
    .in('work_date', dates)
    .order('work_date')

  const rows =
    (data as unknown as
      | {
          id: string
          teacher_id: string
          work_date: string
          planned_start: string
          planned_end: string
          actual_start: string
          actual_end: string
          status: string
          teachers: { first_name: string | null; last_name: string | null } | null
        }[]
      | null) ?? []

  // Latest adjustment reason + count per timesheet (audit trail). Tolerant of the
  // staff_timesheet_adjustments table being absent (migration 095 not yet applied).
  const sheetIds = rows.map((r) => r.id)
  const lastReason = new Map<string, string>()
  const adjCount = new Map<string, number>()
  if (sheetIds.length > 0) {
    const { data: adjData } = await db
      .from('staff_timesheet_adjustments')
      .select('timesheet_id, reason, adjusted_at')
      .eq('school_id', schoolId)
      .in('timesheet_id', sheetIds)
      .order('adjusted_at', { ascending: false })
    for (const a of (adjData as
      | { timesheet_id: string; reason: string; adjusted_at: string }[]
      | null) ?? []) {
      adjCount.set(a.timesheet_id, (adjCount.get(a.timesheet_id) ?? 0) + 1)
      if (!lastReason.has(a.timesheet_id)) lastReason.set(a.timesheet_id, a.reason) // first = latest (desc)
    }
  }

  const entries: TimesheetEntry[] = rows
    .map((r) => ({
      id: r.id,
      teacherId: r.teacher_id,
      teacherName:
        [r.teachers?.first_name, r.teachers?.last_name].filter(Boolean).join(' ') || 'Staff member',
      workDate: r.work_date,
      plannedStart: r.planned_start,
      plannedEnd: r.planned_end,
      actualStart: r.actual_start,
      actualEnd: r.actual_end,
      status: r.status,
      actualMinutes: actualMinutes(r.actual_start, r.actual_end),
      varianceMinutes: varianceMinutes(
        r.planned_start,
        r.planned_end,
        r.actual_start,
        r.actual_end,
      ),
      lastAdjustmentReason: lastReason.get(r.id) ?? null,
      adjustmentCount: adjCount.get(r.id) ?? 0,
    }))
    .sort((a, b) =>
      a.workDate === b.workDate
        ? a.teacherName.localeCompare(b.teacherName)
        : a.workDate.localeCompare(b.workDate),
    )

  const totalsMap = new Map<string, TimesheetStaffTotal>()
  for (const e of entries) {
    const cur = totalsMap.get(e.teacherId) ?? {
      teacherId: e.teacherId,
      name: e.teacherName,
      approvedMinutes: 0,
      totalMinutes: 0,
      pending: 0,
    }
    cur.totalMinutes += e.actualMinutes
    if (e.status === 'APPROVED') cur.approvedMinutes += e.actualMinutes
    else cur.pending += 1
    totalsMap.set(e.teacherId, cur)
  }
  const staffTotals = [...totalsMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  return { weekStart, entries, staffTotals }
}
