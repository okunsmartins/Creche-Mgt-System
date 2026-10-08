import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { shiftMinutes } from './rota'

export interface RotaReportShift {
  date: string
  teacherName: string
  roomName: string | null
  startTime: string // HH:MM:SS
  endTime: string
  minutes: number
}
export interface RotaReportStaffLine {
  teacherId: string
  name: string
  minutes: number
  shifts: number
}
export interface RotaReport {
  shifts: RotaReportShift[]
  byStaff: RotaReportStaffLine[]
  totalMinutes: number
}

type Row = {
  teacher_id: string
  shift_date: string
  start_time: string
  end_time: string
  teachers: { first_name: string; last_name: string } | null
  classes: { name: string } | null
}

/**
 * Planned rota (staff shifts) for a date window [fromISO, toISO] inclusive, school-scoped.
 * Returns the raw shift list (day view + CSV) and per-staff planned-hour totals
 * (week/month). Tolerant of staff_shifts being absent pre-migration.
 */
export async function getRotaReport(
  schoolId: string,
  fromISO: string,
  toISO: string,
): Promise<RotaReport> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('staff_shifts')
    .select(
      'teacher_id, shift_date, start_time, end_time, teachers(first_name, last_name), classes(name)',
    )
    .eq('school_id', schoolId)
    .gte('shift_date', fromISO)
    .lte('shift_date', toISO)
    .order('shift_date', { ascending: true })
    .order('start_time', { ascending: true })

  const rows = (data ?? []) as unknown as Row[]
  const name = (r: Row) =>
    r.teachers ? `${r.teachers.first_name} ${r.teachers.last_name}` : 'Staff'

  const shifts: RotaReportShift[] = rows.map((r) => ({
    date: r.shift_date,
    teacherName: name(r),
    roomName: r.classes?.name ?? null,
    startTime: r.start_time,
    endTime: r.end_time,
    minutes: shiftMinutes(r.start_time, r.end_time),
  }))

  const byStaffMap = new Map<string, RotaReportStaffLine>()
  for (const r of rows) {
    const line =
      byStaffMap.get(r.teacher_id) ??
      ({
        teacherId: r.teacher_id,
        name: name(r),
        minutes: 0,
        shifts: 0,
      } satisfies RotaReportStaffLine)
    line.minutes += shiftMinutes(r.start_time, r.end_time)
    line.shifts += 1
    byStaffMap.set(r.teacher_id, line)
  }
  const byStaff = [...byStaffMap.values()].sort((a, b) => a.name.localeCompare(b.name))
  const totalMinutes = byStaff.reduce((n, s) => n + s.minutes, 0)

  return { shifts, byStaff, totalMinutes }
}
