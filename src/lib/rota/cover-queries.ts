import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ageInMonthsAt } from '@/lib/age/age'
import { roomStaffingRequirement } from '@/lib/ratios/ratio'
import { weekDays } from './rota'
import { needsCover, coverShortfall } from './cover'

export interface RoomCover {
  roomId: string
  roomName: string
  requiredStaff: number
  rosteredStaff: number
  shortfall: number
}

export interface CoverDay {
  date: string
  alerts: RoomCover[]
}

export interface CoverWeek {
  weekStart: string
  days: CoverDay[]
  totalAlerts: number
  roomsTracked: number
}

/**
 * Planned cover alerts for a rota week: for each room, the staff REQUIRED (from its
 * enrolled children's ages via the ratio engine) vs the staff ROSTERED each day (from
 * staff_shifts assigned to that room). Rooms rostered below requirement surface as
 * "needs cover" so it can be arranged before the day. Read-only, school_id-scoped.
 */
export async function getWeekCoverAlerts(schoolId: string, weekStart: string): Promise<CoverWeek> {
  const db = createSupabaseAdminClient()
  const dates = weekDays(weekStart)

  const [{ data: roomData }, { data: childData }, { data: shiftData }] = await Promise.all([
    db
      .from('classes')
      .select('id, name')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('display_order'),
    db
      .from('students')
      .select('id, class_id, date_of_birth')
      .eq('school_id', schoolId)
      .eq('is_active', true),
    db
      .from('staff_shifts')
      .select('teacher_id, class_id, shift_date')
      .eq('school_id', schoolId)
      .in('shift_date', dates)
      .not('class_id', 'is', null),
  ])

  const rooms = (roomData as { id: string; name: string }[] | null) ?? []
  const children =
    (childData as { id: string; class_id: string | null; date_of_birth: string | null }[] | null) ??
    []
  const shifts =
    (shiftData as { teacher_id: string; class_id: string | null; shift_date: string }[] | null) ??
    []

  // Required staff per room from its children's ages (as of the week start).
  const agesByRoom = new Map<string, (number | null)[]>()
  for (const c of children) {
    if (!c.class_id) continue
    const arr = agesByRoom.get(c.class_id) ?? []
    arr.push(c.date_of_birth ? ageInMonthsAt(c.date_of_birth, weekStart) : null)
    agesByRoom.set(c.class_id, arr)
  }
  const requiredByRoom = new Map<string, number>()
  for (const room of rooms) {
    requiredByRoom.set(
      room.id,
      roomStaffingRequirement(agesByRoom.get(room.id) ?? []).requiredStaff,
    )
  }

  // Distinct rostered staff per (room, day).
  const rosterKey = (roomId: string, date: string) => `${roomId}|${date}`
  const rosterSets = new Map<string, Set<string>>()
  for (const s of shifts) {
    if (!s.class_id) continue
    const k = rosterKey(s.class_id, s.shift_date)
    const set = rosterSets.get(k) ?? new Set<string>()
    set.add(s.teacher_id)
    rosterSets.set(k, set)
  }

  const roomsTracked = rooms.filter((r) => (requiredByRoom.get(r.id) ?? 0) > 0).length
  let totalAlerts = 0
  const days: CoverDay[] = dates.map((date) => {
    const alerts: RoomCover[] = []
    for (const room of rooms) {
      const required = requiredByRoom.get(room.id) ?? 0
      const rostered = rosterSets.get(rosterKey(room.id, date))?.size ?? 0
      if (needsCover(required, rostered)) {
        alerts.push({
          roomId: room.id,
          roomName: room.name,
          requiredStaff: required,
          rosteredStaff: rostered,
          shortfall: coverShortfall(required, rostered),
        })
        totalAlerts++
      }
    }
    return { date, alerts }
  })

  return { weekStart, days, totalAlerts, roomsTracked }
}
