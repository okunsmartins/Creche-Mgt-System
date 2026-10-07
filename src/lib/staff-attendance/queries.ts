import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  clockState,
  workedMinutes,
  summariseStaffWork,
  type ClockState,
  type StaffWorkLine,
} from './clocking'

export interface StaffClockEntry {
  teacherId: string
  name: string
  state: ClockState
  clockInAt: string | null
  clockOutAt: string | null
}

type TeacherRow = {
  id: string
  first_name: string | null
  last_name: string | null
  display_name: string | null
}
type ClockRow = { teacher_id: string; clock_in_at: string | null; clock_out_at: string | null }

const nameOf = (t: {
  first_name: string | null
  last_name: string | null
  display_name: string | null
}) => t.display_name || [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Staff member'

/** Today's clock board: every active staff member with their clock state + times. */
export async function getStaffClockBoard(
  schoolId: string,
  dateISO: string,
): Promise<StaffClockEntry[]> {
  const db = createSupabaseAdminClient()
  const [{ data: teacherData }, { data: clockData }] = await Promise.all([
    db
      .from('teachers')
      .select('id, first_name, last_name, display_name')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('first_name')
      .order('last_name'),
    db
      .from('staff_attendance')
      .select('teacher_id, clock_in_at, clock_out_at')
      .eq('school_id', schoolId)
      .eq('work_date', dateISO),
  ])

  const byTeacher = new Map<string, ClockRow>()
  for (const r of (clockData as ClockRow[] | null) ?? []) byTeacher.set(r.teacher_id, r)

  return ((teacherData as TeacherRow[] | null) ?? []).map((t) => {
    const row = byTeacher.get(t.id)
    return {
      teacherId: t.id,
      name: nameOf(t),
      state: clockState(row),
      clockInAt: row?.clock_in_at ?? null,
      clockOutAt: row?.clock_out_at ?? null,
    }
  })
}

export interface StaffAttendanceDailyEntry {
  teacherName: string
  clockInAt: string | null
  clockOutAt: string | null
  minutes: number
}
export interface StaffAttendanceReport {
  from: string
  to: string
  lines: StaffWorkLine[]
  daily: StaffAttendanceDailyEntry[]
}

type ReportRow = {
  teacher_id: string
  work_date: string
  clock_in_at: string | null
  clock_out_at: string | null
  teachers: {
    first_name: string | null
    last_name: string | null
    display_name: string | null
  } | null
}

/** Staff worked hours over [from, to] + the individual clock entries on the `from` date. */
export async function getStaffAttendanceReport(
  schoolId: string,
  from: string,
  to: string,
): Promise<StaffAttendanceReport> {
  const db = createSupabaseAdminClient()
  const { data } = await db
    .from('staff_attendance')
    .select(
      'teacher_id, work_date, clock_in_at, clock_out_at, teachers(first_name, last_name, display_name)',
    )
    .eq('school_id', schoolId)
    .gte('work_date', from)
    .lte('work_date', to)
    .order('work_date')

  const rows = (data as unknown as ReportRow[] | null) ?? []
  const name = (r: ReportRow) =>
    r.teachers
      ? r.teachers.display_name ||
        [r.teachers.first_name, r.teachers.last_name].filter(Boolean).join(' ') ||
        'Staff member'
      : 'Staff member'

  const lines = summariseStaffWork(
    rows.map((r) => ({
      teacherId: r.teacher_id,
      name: name(r),
      clockInAt: r.clock_in_at,
      clockOutAt: r.clock_out_at,
    })),
  )

  const daily: StaffAttendanceDailyEntry[] = rows
    .filter((r) => r.work_date === from)
    .map((r) => ({
      teacherName: name(r),
      clockInAt: r.clock_in_at,
      clockOutAt: r.clock_out_at,
      minutes: workedMinutes(r.clock_in_at, r.clock_out_at),
    }))
    .sort((a, b) => a.teacherName.localeCompare(b.teacherName))

  return { from, to, lines, daily }
}
