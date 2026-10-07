import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ageInMonthsAt } from '@/lib/age/age'
import { roomStaffingRequirement } from './ratio'
import { isPresentNow, type CheckInRow } from '@/lib/checkin/checkin'
import { getRatioBands } from './config'
import { getStaffOnDuty } from './staff-on-duty'

export interface RoomRatioAlert {
  roomId: string
  roomName: string
  childrenPresent: number
  required: number
  available: number
  shortfall: number
  /** Where the available-staff figure came from. */
  source: 'saved' | 'rostered'
}
export interface RatioAlertResult {
  date: string
  alerts: RoomRatioAlert[] // under-ratio rooms only
  roomsChecked: number
}

/**
 * Rooms under their required ratio right now. Required = staff for the children PRESENT now
 * (daily check-in) at the crèche's configured ratios. Available = the saved staff-on-duty
 * for today if set, otherwise the staff ROSTERED to the room today (from the rota).
 * School-scoped; tolerant of the staffing tables being absent.
 */
export async function getRoomRatioAlerts(
  schoolId: string,
  dateISO: string,
): Promise<RatioAlertResult> {
  const db = createSupabaseAdminClient()

  const [
    bands,
    savedStaff,
    { data: roomData },
    { data: childData },
    { data: ciData },
    { data: shiftData },
  ] = await Promise.all([
    getRatioBands(schoolId),
    getStaffOnDuty(schoolId, dateISO),
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
      .from('daily_check_ins')
      .select('student_id, checked_in_at, checked_out_at')
      .eq('school_id', schoolId)
      .eq('date', dateISO),
    db
      .from('staff_shifts')
      .select('teacher_id, class_id')
      .eq('school_id', schoolId)
      .eq('shift_date', dateISO)
      .not('class_id', 'is', null),
  ])

  const rooms = (roomData as { id: string; name: string }[] | null) ?? []
  const children =
    (childData as { id: string; class_id: string | null; date_of_birth: string | null }[] | null) ??
    []
  const presentSet = new Set(
    ((ciData as (CheckInRow & { student_id: string })[] | null) ?? [])
      .filter(isPresentNow)
      .map((r) => r.student_id),
  )

  // Present children's ages per room.
  const agesByRoom = new Map<string, (number | null)[]>()
  for (const c of children) {
    if (!c.class_id || !presentSet.has(c.id)) continue
    const arr = agesByRoom.get(c.class_id) ?? []
    arr.push(c.date_of_birth ? ageInMonthsAt(c.date_of_birth, dateISO) : null)
    agesByRoom.set(c.class_id, arr)
  }

  // Distinct rostered staff per room today.
  const rosteredByRoom = new Map<string, Set<string>>()
  for (const s of (shiftData as { teacher_id: string; class_id: string | null }[] | null) ?? []) {
    if (!s.class_id) continue
    const set = rosteredByRoom.get(s.class_id) ?? new Set<string>()
    set.add(s.teacher_id)
    rosteredByRoom.set(s.class_id, set)
  }

  const alerts: RoomRatioAlert[] = []
  for (const room of rooms) {
    const required = roomStaffingRequirement(agesByRoom.get(room.id) ?? [], bands).requiredStaff
    if (required <= 0) continue
    const saved = savedStaff.get(room.id)
    const available = saved ?? rosteredByRoom.get(room.id)?.size ?? 0
    const source: 'saved' | 'rostered' = saved === undefined ? 'rostered' : 'saved'
    if (available < required) {
      alerts.push({
        roomId: room.id,
        roomName: room.name,
        childrenPresent: (agesByRoom.get(room.id) ?? []).length,
        required,
        available,
        shortfall: required - available,
        source,
      })
    }
  }

  return { date: dateISO, alerts, roomsChecked: rooms.length }
}
