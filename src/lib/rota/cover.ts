// Staff cover alerts (pure) — compares staff ROSTERED to a room on a day against the
// staff REQUIRED for that room's children (from the ratio engine). Surfaces rooms that
// are under-staffed so cover can be arranged before the day. The required figure comes
// from roomStaffingRequirement (lib/ratios/ratio.ts); this file is just the comparison.

/** Staff short of the requirement (0 when met). */
export function coverShortfall(requiredStaff: number, rosteredStaff: number): number {
  return Math.max(0, Math.floor(requiredStaff) - Math.max(0, Math.floor(rosteredStaff)))
}

/** A room/day needs cover when it has a requirement and fewer staff are rostered. */
export function needsCover(requiredStaff: number, rosteredStaff: number): boolean {
  return requiredStaff > 0 && rosteredStaff < requiredStaff
}
