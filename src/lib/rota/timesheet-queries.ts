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
