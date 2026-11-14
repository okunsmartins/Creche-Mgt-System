import 'server-only'
import { createSupabaseAdminClient } from '@/lib/supabase/server'
import { ageInMonthsAt } from '@/lib/age/age'
import { roomStaffingRequirement } from '@/lib/ratios/ratio'
import { getRatioBands } from '@/lib/ratios/config'
import {
  addDaysISO,
  assessLeaveRequest,
  MAX_COVER_DAYS,
  type LeaveAssessment,
  type LeaveRequestLite,
  type RoomRequirement,
  type ShiftLite,
} from './cover'

type RequestRow = {
  id: string
  teacher_id: string
  start_date: string
  end_date: string
  status: 'pending' | 'approved' | 'rejected'
  teachers: {
    first_name: string | null
    last_name: string | null
    display_name: string | null
  } | null
}

const REQUEST_COLS =
  'id, teacher_id, start_date, end_date, status, teachers(first_name, last_name, display_name)'

function toLite(r: RequestRow): LeaveRequestLite {
  const t = r.teachers
  const name =
    t?.display_name ?? ([t?.first_name, t?.last_name].filter(Boolean).join(' ') || 'Staff member')
  return {
    id: r.id,
    teacherId: r.teacher_id,
    name,
    start: r.start_date,
    end: r.end_date,
    status: r.status,
  }
}

/**
 * Clash + ratio-cover assessment for PENDING time-off requests, keyed by request id.
 * Pass `onlyRequestId` to assess just one (used to re-check on approve). School-scoped
 * and unpaginated on purpose — overlap must consider every approved/pending request in
 * the window, not just the most recent page.
 */
export async function assessPendingTimeOff(
  schoolId: string,
  onlyRequestId?: string,
): Promise<Map<string, LeaveAssessment>> {
  const db = createSupabaseAdminClient()
  const out = new Map<string, LeaveAssessment>()

  let pendingQuery = db
    .from('time_off_requests')
    .select(REQUEST_COLS)
    .eq('school_id', schoolId)
    .eq('status', 'pending')
  if (onlyRequestId) pendingQuery = pendingQuery.eq('id', onlyRequestId)
  const { data: pendingData } = await pendingQuery
  const pending = ((pendingData as RequestRow[] | null) ?? []).map(toLite)
  if (pending.length === 0) return out

  // One window covering every pending request (each capped at MAX_COVER_DAYS).
  const from = pending.reduce((m, p) => (p.start < m ? p.start : m), pending[0]!.start)
  const to = pending.reduce((m, p) => {
    const capped =
      p.end > addDaysISO(p.start, MAX_COVER_DAYS - 1)
        ? addDaysISO(p.start, MAX_COVER_DAYS - 1)
        : p.end
    return capped > m ? capped : m
  }, from)

  const [
    { data: overlapData },
    { data: shiftData },
    { data: roomData },
    { data: childData },
    bands,
  ] = await Promise.all([
    db
      .from('time_off_requests')
      .select(REQUEST_COLS)
      .eq('school_id', schoolId)
      .in('status', ['approved', 'pending'])
      .lte('start_date', to)
      .gte('end_date', from),
    db
      .from('staff_shifts')
      .select('teacher_id, class_id, shift_date')
      .eq('school_id', schoolId)
      .gte('shift_date', from)
      .lte('shift_date', to),
    db.from('classes').select('id, name').eq('school_id', schoolId).eq('is_active', true),
    db
      .from('students')
      .select('class_id, date_of_birth')
      .eq('school_id', schoolId)
      .eq('is_active', true),
    getRatioBands(schoolId),
  ])

  const all = ((overlapData as RequestRow[] | null) ?? []).map(toLite)
  const shifts: ShiftLite[] = (
    (shiftData as { teacher_id: string; class_id: string | null; shift_date: string }[] | null) ??
    []
  ).map((s) => ({ teacherId: s.teacher_id, roomId: s.class_id, date: s.shift_date }))

  const agesByRoom = new Map<string, (number | null)[]>()
  for (const c of (childData as
    | { class_id: string | null; date_of_birth: string | null }[]
    | null) ?? []) {
    if (!c.class_id) continue
    const arr = agesByRoom.get(c.class_id) ?? []
    arr.push(c.date_of_birth ? ageInMonthsAt(c.date_of_birth, from) : null)
    agesByRoom.set(c.class_id, arr)
  }
  const rooms: RoomRequirement[] = ((roomData as { id: string; name: string }[] | null) ?? []).map(
    (r) => ({
      roomId: r.id,
      roomName: r.name,
      requiredStaff: roomStaffingRequirement(agesByRoom.get(r.id) ?? [], bands).requiredStaff,
    }),
  )

  for (const p of pending) out.set(p.id, assessLeaveRequest(p, all, shifts, rooms))
  return out
}
