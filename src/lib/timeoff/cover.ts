// Time-off approval impact — pure helpers. Given a pending leave request, works out:
//   1. who else is off (approved) or has asked to be off (pending) on overlapping dates;
//   2. whether taking this person off the rota leaves any room below its ratio cover.
// Dates are inclusive `YYYY-MM-DD` strings (string order = chronological).

import { datesOverlap, type LeaveInterval } from './clash'

/** Longest leave span (days) the cover check walks, so a typo'd year can't loop forever. */
export const MAX_COVER_DAYS = 62

export interface LeaveRequestLite extends LeaveInterval {
  id: string
  status: 'pending' | 'approved' | 'rejected'
}

export interface ShiftLite {
  teacherId: string
  roomId: string | null
  date: string
}

export interface RoomRequirement {
  roomId: string
  roomName: string
  requiredStaff: number
}

export interface CoverShortfall {
  date: string
  roomId: string
  roomName: string
  requiredStaff: number
  /** Staff left in the room that day if this leave is approved. */
  staffIfApproved: number
}

export interface LeaveAssessment {
  /** Other staff already APPROVED off on overlapping dates. */
  approvedOverlap: string[]
  /** Other staff with PENDING requests on overlapping dates. */
  pendingOverlap: string[]
  /** Room/days that would fall below ratio cover if approved. */
  shortfalls: CoverShortfall[]
  /** Whether this person has any rota shifts in the leave window (else cover can't be judged). */
  onRota: boolean
}

/** True when the assessment carries anything the approver should see before approving. */
export function hasWarnings(a: LeaveAssessment): boolean {
  return a.approvedOverlap.length > 0 || a.pendingOverlap.length > 0 || a.shortfalls.length > 0
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Inclusive list of dates from start to end, capped at MAX_COVER_DAYS. */
export function datesInRange(start: string, end: string): string[] {
  const out: string[] = []
  for (let d = start; d <= end && out.length < MAX_COVER_DAYS; d = addDaysISO(d, 1)) out.push(d)
  return out
}

function distinctNames(list: LeaveInterval[]): string[] {
  return [...new Set(list.map((l) => l.name))]
}

/**
 * Assess one pending request against everyone else's leave and the rota.
 *
 * Cover rule: for each day of the leave where this person is rostered to a room, count
 * the distinct staff rostered to that room that day who are NOT on approved leave, then
 * remove this person. If that falls below the room's required staff, it's a shortfall.
 * Only shortfalls this approval causes or deepens are reported (the person must be
 * rostered in that room that day) — pre-existing gaps belong to the rota cover alerts.
 */
export function assessLeaveRequest(
  target: LeaveRequestLite,
  allRequests: LeaveRequestLite[],
  shifts: ShiftLite[],
  rooms: RoomRequirement[],
): LeaveAssessment {
  const others = allRequests.filter(
    (r) =>
      r.id !== target.id &&
      r.teacherId !== target.teacherId &&
      datesOverlap(target.start, target.end, r.start, r.end),
  )
  const approvedOthers = others.filter((r) => r.status === 'approved')
  const pendingOthers = others.filter((r) => r.status === 'pending')

  const days = datesInRange(target.start, target.end)
  const daySet = new Set(days)
  const roomById = new Map(rooms.map((r) => [r.roomId, r]))

  const offOn = (teacherId: string, date: string) =>
    approvedOthers.some((r) => r.teacherId === teacherId && r.start <= date && date <= r.end)

  // Distinct staff per room/day (excluding people already approved off that day).
  const staffByRoomDay = new Map<string, Set<string>>()
  let onRota = false
  for (const s of shifts) {
    if (!daySet.has(s.date)) continue
    if (s.teacherId === target.teacherId) onRota = true
    if (!s.roomId) continue
    if (s.teacherId !== target.teacherId && offOn(s.teacherId, s.date)) continue
    const k = `${s.roomId}|${s.date}`
    const set = staffByRoomDay.get(k) ?? new Set<string>()
    set.add(s.teacherId)
    staffByRoomDay.set(k, set)
  }

  const shortfalls: CoverShortfall[] = []
  for (const [k, staff] of staffByRoomDay) {
    if (!staff.has(target.teacherId)) continue
    const [roomId, date] = k.split('|') as [string, string]
    const room = roomById.get(roomId)
    if (!room || room.requiredStaff <= 0) continue
    const staffIfApproved = staff.size - 1
    if (staffIfApproved < room.requiredStaff) {
      shortfalls.push({
        date,
        roomId,
        roomName: room.roomName,
        requiredStaff: room.requiredStaff,
        staffIfApproved,
      })
    }
  }
  shortfalls.sort((a, b) =>
    a.date === b.date ? a.roomName.localeCompare(b.roomName) : a.date < b.date ? -1 : 1,
  )

  return {
    approvedOverlap: distinctNames(approvedOthers),
    pendingOverlap: distinctNames(pendingOthers).filter(
      (n) => !approvedOthers.some((a) => a.name === n),
    ),
    shortfalls,
    onRota,
  }
}

/** Plain-English lines for the approver (used in the UI and the confirm step). */
export function describeAssessment(a: LeaveAssessment): string[] {
  const lines: string[] = []
  if (a.approvedOverlap.length > 0)
    lines.push(`Already off on some of these dates: ${a.approvedOverlap.join(', ')}.`)
  if (a.pendingOverlap.length > 0)
    lines.push(`Also asked for overlapping dates (pending): ${a.pendingOverlap.join(', ')}.`)
  for (const s of a.shortfalls.slice(0, 5)) {
    lines.push(
      `${s.date}: ${s.roomName} would have ${s.staffIfApproved} staff but needs ${s.requiredStaff} for its ratio.`,
    )
  }
  if (a.shortfalls.length > 5) lines.push(`…and ${a.shortfalls.length - 5} more room-days short.`)
  return lines
}
