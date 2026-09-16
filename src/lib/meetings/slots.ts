// Pure slot-generation + wall-clock helpers for parent–teacher meeting booking.
// All times are wall-clock strings (HH:MM / HH:MM:SS, ISO dates) — never Date
// arithmetic across timezones.

export const SLOT_DURATIONS_MINS = [10, 15, 20, 30, 45, 60] as const
export type SlotDuration = (typeof SLOT_DURATIONS_MINS)[number]

/** Safety cap: one availability block can generate at most this many slots. */
export const MAX_SLOTS_PER_BLOCK = 40

export interface GeneratedSlot {
  /** HH:MM (24h) */
  start: string
  /** HH:MM (24h) */
  end: string
}

/** Parse "HH:MM" (or "HH:MM:SS") to minutes since midnight; null if malformed. */
export function parseTimeToMinutes(time: string): number | null {
  const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(time)
  if (!m) return null
  const hours = Number(m[1])
  const minutes = Number(m[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * Generate consecutive meeting slots covering [startTime, endTime). Only whole
 * slots are produced (a trailing remainder shorter than the duration is
 * dropped). Returns null when the inputs are invalid (malformed time, unknown
 * duration, start >= end, or more than MAX_SLOTS_PER_BLOCK slots).
 */
export function generateMeetingSlots(
  startTime: string,
  endTime: string,
  durationMins: number,
): GeneratedSlot[] | null {
  if (!SLOT_DURATIONS_MINS.includes(durationMins as SlotDuration)) return null
  const start = parseTimeToMinutes(startTime)
  const end = parseTimeToMinutes(endTime)
  if (start === null || end === null || start >= end) return null
  if ((end - start) / durationMins > MAX_SLOTS_PER_BLOCK) return null

  const slots: GeneratedSlot[] = []
  for (let t = start; t + durationMins <= end; t += durationMins) {
    slots.push({ start: minutesToTime(t), end: minutesToTime(t + durationMins) })
  }
  return slots.length > 0 ? slots : null
}

export interface ExistingSlotTimes {
  /** HH:MM or HH:MM:SS */
  start_time: string
  /** HH:MM or HH:MM:SS */
  end_time: string
}

/**
 * Drop generated slots that OVERLAP any existing slot on the same day. The
 * UNIQUE(teacher, date, start_time) constraint only catches identical starts —
 * republishing the same window with a different slot length would otherwise
 * create overlapping bookable slots (e.g. 14:15–14:30 and 14:20–14:40), letting
 * two parents book the teacher for overlapping times.
 */
export function filterNonOverlappingSlots(
  generated: GeneratedSlot[],
  existing: ExistingSlotTimes[],
): GeneratedSlot[] {
  const existingRanges = existing
    .map((e) => ({ start: parseTimeToMinutes(e.start_time), end: parseTimeToMinutes(e.end_time) }))
    .filter((e): e is { start: number; end: number } => e.start !== null && e.end !== null)

  return generated.filter((g) => {
    const gStart = parseTimeToMinutes(g.start)
    const gEnd = parseTimeToMinutes(g.end)
    if (gStart === null || gEnd === null) return false
    return !existingRanges.some((e) => e.start < gEnd && gStart < e.end)
  })
}

/**
 * Whether a slot is in the future relative to "now" expressed as wall-clock
 * strings (today = ISO yyyy-mm-dd, nowTime = HH:MM). Pure so it is testable;
 * callers pass the school's current wall-clock.
 */
export function isSlotInFuture(
  slotDate: string,
  slotStartTime: string,
  today: string,
  nowTime: string,
): boolean {
  if (slotDate > today) return true
  if (slotDate < today) return false
  const slot = parseTimeToMinutes(slotStartTime)
  const now = parseTimeToMinutes(nowTime)
  if (slot === null || now === null) return false
  return slot > now
}

/** Current wall-clock in the school's timezone (Europe/Dublin) as ISO date + HH:MM. */
export function schoolNow(): { today: string; nowTime: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Dublin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00'
  return {
    today: `${get('year')}-${get('month')}-${get('day')}`,
    // Intl can emit "24" for midnight with hour12:false in some engines — normalise.
    nowTime: `${get('hour') === '24' ? '00' : get('hour')}:${get('minute')}`,
  }
}

/** Format "HH:MM[:SS]" for display, e.g. "14:30". */
export function formatSlotTime(time: string): string {
  return time.slice(0, 5)
}
