import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import {
  summariseByChild,
  operatingDays,
  isPresent,
  type CheckinLite,
  type ChildRangeSummary,
} from './checkinReport'

export interface ReportChild {
  id: string
  name: string
  roomName: string
}
export interface DailyEntry {
  studentId: string
  name: string
  roomName: string
  present: boolean
  checkedInAt: string | null
  checkedOutAt: string | null
}
export interface RangeEntry extends ChildRangeSummary {
  name: string
  roomName: string
}
export interface AttendanceReport {
  from: string
  to: string
  operating: number
  childCount: number
  daily: DailyEntry[] // for the `from` date (used in day view)
  range: RangeEntry[] // per-child over [from, to]
}

type ChildRow = {
  id: string
  first_name: string | null
  last_name: string | null
  classes: { name: string | null } | { name: string | null }[] | null
}
type CiRow = CheckinLite & { checked_out_at: string | null }

function roomNameOf(c: ChildRow): string {
  const cls = Array.isArray(c.classes) ? c.classes[0] : c.classes
  return cls?.name ?? 'Unassigned'
}

/**
 * Attendance report over [from, to] derived from daily check-ins. School-scoped.
 * `range` is the per-child present/absent summary; `daily` is each child's status + times on
 * the `from` date (used by the day view).
 */
export async function getAttendanceReport(
  schoolId: string,
  from: string,
  to: string,
): Promise<AttendanceReport> {
  const db = createSupabaseAdminClient()

  const [{ data: childData }, { data: ciData }] = await Promise.all([
    db
      .from('students')
      .select('id, first_name, last_name, classes(name)')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('last_name'),
    db
      .from('daily_check_ins')
      .select('student_id, date, checked_in_at, checked_out_at, status')
      .eq('school_id', schoolId)
      .gte('date', from)
      .lte('date', to),
  ])

  const children = (childData as ChildRow[] | null) ?? []
  const rows = (ciData as CiRow[] | null) ?? []

  const nameOf = new Map<string, string>()
  const roomOf = new Map<string, string>()
  for (const c of children) {
    nameOf.set(c.id, [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Child')
    roomOf.set(c.id, roomNameOf(c))
  }

  const studentIds = children.map((c) => c.id)
  const opDays = operatingDays(rows)
  const summary = summariseByChild(studentIds, rows, opDays)

  const range: RangeEntry[] = children
    .map((c) => {
      const s = summary.get(c.id)!
      return { ...s, name: nameOf.get(c.id)!, roomName: roomOf.get(c.id)! }
    })
    .sort((a, b) => a.roomName.localeCompare(b.roomName) || a.name.localeCompare(b.name))

  // Day view: status + times for the `from` date.
  const dayRowByStudent = new Map<string, CiRow>()
  for (const r of rows) if (r.date === from) dayRowByStudent.set(r.student_id, r)
  const daily: DailyEntry[] = children
    .map((c) => {
      const r = dayRowByStudent.get(c.id)
      return {
        studentId: c.id,
        name: nameOf.get(c.id)!,
        roomName: roomOf.get(c.id)!,
        present: isPresent(r),
        checkedInAt: r?.checked_in_at ?? null,
        checkedOutAt: r?.checked_out_at ?? null,
      }
    })
    .sort((a, b) => a.roomName.localeCompare(b.roomName) || a.name.localeCompare(b.name))

  return {
    from,
    to,
    operating: opDays.length,
    childCount: children.length,
    daily,
    range,
  }
}
