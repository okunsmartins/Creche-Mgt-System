import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { weekDays, shiftMinutes } from './rota'

export interface RotaShift {
  id: string
  teacherId: string
  teacherName: string
  classId: string | null
  roomName: string | null
  shiftDate: string
  startTime: string
  endTime: string
  label: string | null
  minutes: number
}

export interface RotaDay {
  date: string
  shifts: RotaShift[]
}

export interface RotaOption {
  id: string
  name: string
}

export interface RotaWeek {
  weekStart: string
  days: RotaDay[]
  staffTotals: { teacherId: string; name: string; minutes: number }[]
  staffOptions: RotaOption[]
  roomOptions: RotaOption[]
}

/**
 * The staff rota for one week (Mon–Sun): shifts grouped by day, per-staff weekly hour
 * totals, and the active-staff / active-room options for the add-shift form. All
 * school_id-scoped.
 */
export async function getWeekRota(schoolId: string, weekStart: string): Promise<RotaWeek> {
  const db = createSupabaseAdminClient()
  const dates = weekDays(weekStart)

  const [{ data: shiftData }, { data: staffData }, { data: roomData }] = await Promise.all([
    db
      .from('staff_shifts')
      .select(
        'id, teacher_id, class_id, shift_date, start_time, end_time, label, teachers(first_name, last_name), classes(name)',
      )
      .eq('school_id', schoolId)
      .in('shift_date', dates)
      .order('start_time'),
    db
      .from('teachers')
      .select('id, first_name, last_name')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('last_name'),
    db
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('display_order'),
  ])

  const rows =
    (shiftData as unknown as
      | {
          id: string
          teacher_id: string
          class_id: string | null
          shift_date: string
          start_time: string
          end_time: string
          label: string | null
          teachers: { first_name: string | null; last_name: string | null } | null
          classes: { name: string } | null
        }[]
      | null) ?? []

  const shifts: RotaShift[] = rows.map((r) => ({
    id: r.id,
    teacherId: r.teacher_id,
    teacherName:
      [r.teachers?.first_name, r.teachers?.last_name].filter(Boolean).join(' ') || 'Staff member',
    classId: r.class_id,
    roomName: r.classes?.name ?? null,
    shiftDate: r.shift_date,
    startTime: r.start_time,
    endTime: r.end_time,
    label: r.label,
    minutes: shiftMinutes(r.start_time, r.end_time),
  }))

  const days: RotaDay[] = dates.map((date) => ({
    date,
    shifts: shifts.filter((s) => s.shiftDate === date),
  }))

  // Per-staff weekly totals (only staff who have shifts this week).
  const totalsMap = new Map<string, { teacherId: string; name: string; minutes: number }>()
  for (const s of shifts) {
    const cur = totalsMap.get(s.teacherId) ?? {
      teacherId: s.teacherId,
      name: s.teacherName,
      minutes: 0,
    }
    cur.minutes += s.minutes
    totalsMap.set(s.teacherId, cur)
  }
  const staffTotals = [...totalsMap.values()].sort((a, b) => a.name.localeCompare(b.name))

  const staffOptions: RotaOption[] = (
    (staffData as { id: string; first_name: string | null; last_name: string | null }[] | null) ??
    []
  ).map((t) => ({
    id: t.id,
    name: [t.first_name, t.last_name].filter(Boolean).join(' ') || 'Staff member',
  }))
  const roomOptions: RotaOption[] = ((roomData as { id: string; name: string }[] | null) ?? []).map(
    (c) => ({ id: c.id, name: c.name }),
  )

  return { weekStart, days, staffTotals, staffOptions, roomOptions }
}
